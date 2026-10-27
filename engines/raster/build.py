#!/usr/bin/env python3
"""Rebuild Raster sources, verify the pinned module, compose and qualify firmware.

Needs Python 3, Clang with Cortex-M4F target, ARM GNU ld and Node 24+.
Uses only this source tree and the exact official MicroFreak 5.0.0.2084 .mff.
No firmware is downloaded or published. Output directory must be new/empty.
"""
import argparse,hashlib,json,subprocess
from pathlib import Path
from export_module import export_module
HERE=Path(__file__).resolve().parent;WEB=HERE.parents[1]
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--base',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--compiler',default='clang++');p.add_argument('--assembler',default='clang');p.add_argument('--linker',default='arm-none-eabi-ld');p.add_argument('--node',default='node');p.add_argument('--recipe',type=Path);a=p.parse_args()
 if a.output.exists() and any(a.output.iterdir()):raise ValueError('Output must be new or empty')
 library=json.loads((WEB/'library.json').read_text())
 if hashlib.sha256(a.base.read_bytes()).hexdigest()!=library['base']['sha256']:raise ValueError('Requires exact official MicroFreak 5.0.0.2084 .mff')
 a.output.mkdir(parents=True,exist_ok=True);cpp=a.output/'native.o';screen=a.output/'screen.o';combined=a.output/'raster.o'
 target=['--target=arm-none-eabi','-mcpu=cortex-m4','-mthumb'];flags=['-mfpu=fpv4-sp-d16','-mfloat-abi=hard','-Oz','-std=c++11','-fno-builtin','-fno-exceptions','-fno-rtti','-ffunction-sections','-fdata-sections','-fno-unwind-tables','-fno-asynchronous-unwind-tables']
 commands=[[a.compiler,*target,*flags,'-c',str(HERE/'raster_native.cc'),'-o',str(cpp)],[a.assembler,*target,'-c',str(HERE/'raster_screen.S'),'-o',str(screen)],[a.linker,'-r',str(cpp),str(screen),'-o',str(combined)]]
 for c in commands:subprocess.run(c,check=True)
 m=export_module(combined,['raster_init','raster_parameter','raster_render','raster_screen']);data=(json.dumps(m,indent=2)+'\n').encode();digest=hashlib.sha256(data).hexdigest();(a.output/'module.json').write_bytes(data)
 expected=library['extensions']['raster']['module']
 if digest!=expected:raise ValueError('Compiler output differs from qualified module: '+digest+'; expected '+expected+'. Do not substitute unqualified code.')
 source_names=['raster_native.cc','raster_clock.h','raster_screen.S','export_module.py','build.py','build.mjs'];provenance=dict(compiler=subprocess.check_output([a.compiler,'--version'],text=True).splitlines()[0],module_sha256=digest,source_sha256={n:hashlib.sha256((HERE/n).read_bytes()).hexdigest() for n in source_names},commands=commands)
 (a.output/'compilation.json').write_text(json.dumps(provenance,indent=2)+'\n')
 command=[a.node,str(HERE/'build.mjs'),str(a.base.resolve()),str(a.output.resolve())]
 if a.recipe:command.append(str(a.recipe.resolve()))
 subprocess.run(command,check=True)
if __name__=='__main__':main()
