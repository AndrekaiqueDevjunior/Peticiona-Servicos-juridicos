from __future__ import annotations

from importlib.abc import MetaPathFinder
from importlib.machinery import SourcelessFileLoader
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import sys
import types

APP_ROOT = Path(__file__).resolve().parent
PYC_TAG = "cpython-312"


class AppPycFinder(MetaPathFinder):
    def find_spec(self, fullname: str, path=None, target=None):
        if fullname == "app":
            return None
        if not fullname.startswith("app."):
            return None

        parts = fullname.split(".")[1:]
        base = APP_ROOT.joinpath(*parts)

        if base.is_dir():
            if (base / "__init__.py").exists():
                return None
            init_pyc = base / "__pycache__" / f"__init__.{PYC_TAG}.pyc"
            if init_pyc.exists():
                loader = SourcelessFileLoader(fullname, str(init_pyc))
                return spec_from_file_location(
                    fullname,
                    init_pyc,
                    loader=loader,
                    submodule_search_locations=[str(base)],
                )
            return None

        if base.with_suffix(".py").exists():
            return None

        pyc_path = base.parent / "__pycache__" / f"{base.name}.{PYC_TAG}.pyc"
        if not pyc_path.exists():
            return None

        loader = SourcelessFileLoader(fullname, str(pyc_path))
        return spec_from_file_location(fullname, pyc_path, loader=loader)


def install_pyc_finder() -> None:
    if any(isinstance(finder, AppPycFinder) for finder in sys.meta_path):
        return
    sys.meta_path.insert(0, AppPycFinder())


def load_pyc_module(module_name: str, pyc_path: Path) -> types.ModuleType:
    loader = SourcelessFileLoader(module_name, str(pyc_path))
    spec = spec_from_file_location(module_name, pyc_path, loader=loader)
    if spec is None:
        raise ImportError(f"Could not load spec for {module_name} from {pyc_path}")

    module = module_from_spec(spec)
    loader.exec_module(module)
    return module
