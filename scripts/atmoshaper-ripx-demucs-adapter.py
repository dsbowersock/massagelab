"""Headless, CPU-only adapter for RipX's bundled Demucs installation.

The Node owner verifies this file and the HTDemucs model weights by SHA-256
before invoking it.  This adapter deliberately exposes only a provenance probe
and the fixed two-stem vocals separation used by AtmoShaper auditions.
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import sys
from pathlib import Path


ADAPTER_VERSION = "atmoshaper-ripx-demucs-v1"
sys.dont_write_bytecode = True


def _demucs_version() -> str:
    """Read installed package metadata on both RipX Python 3.7 and newer Python."""

    try:
        from importlib import metadata
    except ImportError:
        import pkg_resources

        return pkg_resources.get_distribution("demucs").version
    return metadata.version("demucs")


def _configure_ripx_imports(rip_script_lib: Path) -> None:
    """Make the verified RipScriptLib authoritative and disable CUDA shims."""

    resolved = rip_script_lib.resolve(strict=True)
    sys.path = [
        entry
        for entry in sys.path
        if not os.path.normcase(os.path.normpath(entry)).endswith(
            os.path.normcase(os.path.normpath(os.sep + "CUDA"))
        )
    ]
    sys.path.insert(0, str(resolved))


def _probe(args: argparse.Namespace) -> int:
    _configure_ripx_imports(args.rip_script_lib)
    import demucs  # pylint: disable=import-outside-toplevel

    print(
        json.dumps(
            {
                "adapterVersion": ADAPTER_VERSION,
                "pythonVersion": platform.python_version(),
                "demucsVersion": _demucs_version(),
                "demucsModulePath": str(Path(demucs.__file__).resolve(strict=True)),
                "backend": "ripx-cpu",
                "device": "cpu",
            },
            sort_keys=True,
        )
    )
    return 0


def _separate(args: argparse.Namespace) -> int:
    _configure_ripx_imports(args.rip_script_lib)
    from demucs.separate import main as demucs_main  # pylint: disable=import-outside-toplevel

    input_path = args.input.resolve(strict=True)
    model_repo = args.model_repo.resolve(strict=True)
    output_dir = args.output_dir.resolve(strict=True)
    sys.argv = [
        "demucs.separate",
        "-d",
        "cpu",
        "-n",
        "htdemucs",
        "--repo",
        str(model_repo),
        "--two-stems",
        "vocals",
        "--int24",
        "-o",
        str(output_dir),
        str(input_path),
    ]
    demucs_main()
    return 0


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="AtmoShaper RipX Demucs adapter")
    parser.add_argument("--rip-script-lib", type=Path, required=True)
    subparsers = parser.add_subparsers(dest="mode", required=True)
    subparsers.add_parser("probe")
    separate = subparsers.add_parser("separate")
    separate.add_argument("--model-repo", type=Path, required=True)
    separate.add_argument("--output-dir", type=Path, required=True)
    separate.add_argument("--input", type=Path, required=True)
    return parser


def main() -> int:
    args = _parser().parse_args()
    return _probe(args) if args.mode == "probe" else _separate(args)


if __name__ == "__main__":
    raise SystemExit(main())
