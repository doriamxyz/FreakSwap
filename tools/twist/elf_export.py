"""ELF32 ARM closure exporter; only code/constants and known relocations."""
from dataclasses import dataclass
import struct,base64
@dataclass
class Section:
    index: int
    name: str
    type: int
    offset: int
    size: int
    link: int
    info: int
    align: int
    entsize: int
    data: bytes


@dataclass
class Symbol:
    name: str
    value: int
    size: int
    info: int
    section_index: int


class Elf32:
    def __init__(self, data: bytes):
        self.data = data
        if data[:7] != b"\x7fELF\x01\x01\x01":
            raise ValueError("expected little-endian ELF32")
        header = struct.unpack_from("<16sHHIIIIIHHHHHH", data, 0)
        machine, shoff, shentsize, shnum, shstrndx = (
            header[2], header[6], header[11], header[12], header[13]
        )
        if machine != 40 or shentsize != 40:
            raise ValueError("expected ELF32 ARM section table")
        raw_headers = [
            struct.unpack_from("<IIIIIIIIII", data, shoff + i * shentsize)
            for i in range(shnum)
        ]
        shstr = raw_headers[shstrndx]
        names = data[shstr[4]:shstr[4] + shstr[5]]

        def string(table: bytes, offset: int) -> str:
            end = table.find(b"\0", offset)
            return table[offset:end].decode()

        self.sections: list[Section] = []
        for index, raw in enumerate(raw_headers):
            name_off, sh_type, _, _, offset, size, link, info, align, entsize = raw
            self.sections.append(Section(
                index, string(names, name_off) if name_off else "", sh_type,
                offset, size, link, info, align or 1, entsize,
                data[offset:offset + size],
            ))

        symtab = next(section for section in self.sections if section.type == 2)
        strtab = self.sections[symtab.link].data
        self.symbols: list[Symbol] = []
        for offset in range(0, symtab.size, symtab.entsize):
            name_off, value, size, info, _, shndx = struct.unpack_from(
                "<IIIBBH", symtab.data, offset
            )
            self.symbols.append(Symbol(
                string(strtab, name_off) if name_off else "",
                value, size, info, shndx,
            ))



EXTERNALS={}
def export_object(path,contract):
 e=Elf32(path.read_bytes());symbols={s.name:s for s in e.symbols if s.name}
 rels={s.info:[struct.unpack_from('<II',s.data,i) for i in range(0,s.size,s.entsize)] for s in e.sections if s.type==9}
 selected=[];pending=[symbols[n].section_index for n in contract['roots']]
 while pending:
  idx=pending.pop(0)
  if idx in selected:continue
  if not 0<idx<len(e.sections):raise ValueError('Invalid closure')
  selected.append(idx)
  for off,info in rels.get(idx,[]):
   sym=e.symbols[info>>8]
   if sym.name in EXTERNALS:continue
   if not sym.section_index:raise ValueError('Unresolved symbol: '+sym.name)
   if sym.section_index not in selected:pending.append(sym.section_index)
 # Stable IDs preserve the historical section-name tie-break without shipping symbols/paths.
 ordered=sorted(selected,key=lambda i:e.sections[i].name);ids={idx:n for n,idx in enumerate(ordered)}
 def target(sym):
  return {'external':EXTERNALS[sym.name]} if sym.name in EXTERNALS else {'section':ids[sym.section_index],'value':sym.value}
 sections=[]
 for idx in ordered:
  s=e.sections[idx];rr=[]
  if s.type!=1:raise ValueError('Only defined code/constant sections can be exported')
  for offset,info in rels.get(idx,[]):
   typ=info&255
   if typ not in [2,10,30,47,48]:raise ValueError('Unsupported relocation')
   rr.append({'offset':offset,'type':typ,'target':target(e.symbols[info>>8])})
  sections.append({'id':ids[idx],'size':s.size,'alignment':s.align,'data':base64.b64encode(s.data).decode(),'relocations':rr})
 return {'format':'freakswap.arm-module','version':1,'sections':sections,'roots':[target(symbols[n]) for n in contract['roots']]}
