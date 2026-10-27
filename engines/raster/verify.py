#!/usr/bin/env python3
"""Recompose, execute ARM checks and compare an existing Raster build package."""
import argparse,subprocess
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--base',type=Path,required=True);p.add_argument('--candidate',type=Path,required=True);p.add_argument('--node',default='node');a=p.parse_args()
subprocess.run([a.node,str(Path(__file__).with_name('build.mjs')),str(a.base.resolve()),str(a.candidate.resolve()),'--verify'],check=True)
