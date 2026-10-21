#!/usr/bin/env python3
"""Rebuild and verify twelve DSP closures and the TWIST runtime, without firmware.

Requires a clang supporting ARM and LLVM ld.lld (or Zig's ld.lld command).
No network or official firmware is used. Output goes in a temporary directory.
"""
import argparse,base64,hashlib,json,shlex,struct,subprocess,tempfile
from pathlib import Path
import elf_export
HERE=Path(__file__).resolve().parent
contracts=json.loads((HERE/'build-contracts.json').read_text())
elf_export.EXTERNALS=contracts['externals']
flags=['--target=arm-none-eabi','-mcpu=cortex-m4','-mthumb','-mfpu=fpv4-sp-d16','-mfloat-abi=hard','-std=c++11','-fno-exceptions','-fno-rtti','-ffunction-sections','-fdata-sections','-fno-unwind-tables','-fno-asynchronous-unwind-tables']
def exported(obj,roots):
 m=elf_export.export_object(obj,{'roots':roots})
 for section in m['sections']:
  data=base64.b64decode(section['data'])
  for rel in section['relocations']:
   if rel['type']==2:rel['target']['external' if 'external' in rel['target'] else 'value']+=struct.unpack_from('<I',data,rel['offset'])[0]
 data=(json.dumps(m,indent=2)+'\n').encode()
 return hashlib.sha256(data).hexdigest(),data

def main():
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--clang',default='clang++')
 parser.add_argument('--linker',default='ld.lld',help='Command, e.g. "zig ld.lld"')
 args=parser.parse_args();inc=['-I'+str(HERE/p) for p in ['src','include','shims','vendor']]
 with tempfile.TemporaryDirectory(prefix='freakswap-twist-') as folder:
  build=Path(folder)
  for key,c in contracts['engines'].items():
   unit=build/(key+'.cc');obj=build/(key+'.o')
   unit.write_text('#include "'+c['source']+'.cc"\n'+c['wrapper']+'\nstatic_assert(sizeof(plaits::'+c['class']+')=='+str(c['object_bytes'])+',"object ABI");\nstatic_assert(sizeof(plaits::EngineParameters)==24,"parameter ABI");\n'+''.join('static_assert(__builtin_offsetof(plaits::EngineParameters,'+field+')=='+str(offset)+',"parameter offset");\n' for field,offset in [('trigger',0),('note',4),('timbre',8),('morph',12),('harmonics',16),('accent',20)]))
   subprocess.run([args.clang,*flags,*(['-fno-builtin'] if c['no_builtin'] else []),c['optimize'],*inc,'-DTW_INDEX='+str(c['index']),*['-D'+d for d in c['defines']],'-c',str(unit),'-o',str(obj)],check=True)
   mid,data=exported(obj,c['roots']);assert mid==c['module'],(key,mid,c['module'])
   assert data==(HERE.parents[1]/'v2/modules'/f'{mid}.json').read_bytes()
   print('PASS',key,mid)
  objects=[]
  for name in ['controls.cc','bridges.S']:
   obj=build/(name+'.o');subprocess.run([args.clang,*flags,'-fno-builtin','-ffreestanding','-Oz',*inc,'-c',str(HERE/'src'/name),'-o',str(obj)],check=True);objects.append(obj)
  obj=build/'runtime.o';subprocess.run([*shlex.split(args.linker),'-r',*map(str,objects),'-o',str(obj)],check=True)
  mid,data=exported(obj,contracts['runtime_roots']);assert mid==contracts['runtime_module'],('runtime',mid,contracts['runtime_module'])
  assert data==(HERE.parents[1]/'v2/modules'/f'{mid}.json').read_bytes()
  print('PASS TWIST runtime',mid)

if __name__=='__main__':main()
