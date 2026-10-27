"""Minimal ELF32 ARM relocatable closure exporter (Python standard library)."""
import base64,struct

def export_module(path,roots):
 data=path.read_bytes();h=struct.unpack_from('<16sHHIIIIIHHHHHH',data)
 if data[:7]!=b'\x7fELF\x01\x01\x01' or h[1]!=1 or h[2]!=40 or h[11]!=40:raise ValueError('Requires relocatable ELF32 ARM')
 rows=[struct.unpack_from('<10I',data,h[6]+i*40) for i in range(h[12])];names_row=rows[h[13]];names=data[names_row[4]:names_row[4]+names_row[5]]
 name=lambda table,at:table[at:].split(b'\0',1)[0].decode()
 sections=[]
 for r in rows:sections.append(dict(name=name(names,r[0]),type=r[1],size=r[5],link=r[6],info=r[7],align=r[8],entsize=r[9],data=data[r[4]:r[4]+r[5]]))
 tables={}
 for i,s in enumerate(sections):
  if s['type']!=2:continue
  st=sections[s['link']]['data'];symbols=[]
  for off in range(0,s['size'],s['entsize']):
   n,value,size,info,other,idx=struct.unpack_from('<IIIBBH',s['data'],off);symbols.append(dict(name=name(st,n),value=value,section=idx))
  tables[i]=symbols
 symbols={s['name']:s for table in tables.values() for s in table if s['name']};rels={}
 for s in sections:
  if s['type']==9:
   rr=[]
   for off in range(0,s['size'],s['entsize']):
    pos,info=struct.unpack_from('<II',s['data'],off);rr.append((pos,info&255,tables[s['link']][info>>8]))
   rels[s['info']]=rr
 selected=[];pending=[symbols[n]['section'] for n in roots]
 while pending:
  idx=pending.pop(0)
  if idx in selected:continue
  if not 0<idx<len(sections):raise ValueError('Unresolved/absolute closure symbol')
  selected.append(idx)
  for off,typ,sym in rels.get(idx,[]):
   if not 0<sym['section']<len(sections):raise ValueError('Unresolved symbol: '+sym['name'])
   if sym['section'] not in selected:pending.append(sym['section'])
 ordered=sorted(selected,key=lambda i:sections[i]['name']);ids={idx:n for n,idx in enumerate(ordered)}
 def target(sym):return dict(section=ids[sym['section']],value=sym['value'])
 output=[]
 for idx in ordered:
  s=sections[idx]
  if s['type']!=1:raise ValueError('Only defined code/constant sections supported')
  rr=[]
  for off,typ,sym in rels.get(idx,[]):
   if typ not in [2,10,30,47,48]:raise ValueError('Unsupported ARM relocation: '+str(typ))
   rr.append(dict(offset=off,type=typ,target=target(sym)))
  output.append(dict(id=ids[idx],size=s['size'],alignment=s['align'],data=base64.b64encode(s['data']).decode(),relocations=rr))
 output.append(dict(id=len(output),size=7,alignment=1,data=base64.b64encode(b'Raster\0').decode(),relocations=[]))
 return dict(format='freakswap.arm-module',version=1,sections=output,roots=[target(symbols[n]) for n in roots])
