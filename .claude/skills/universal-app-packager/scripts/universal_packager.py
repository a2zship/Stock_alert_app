"""
UNIVERSAL APP PACKAGER CLI
Cong cu dong goi phan mem tong quat cho moi du an (Python/FastAPI, Node.js/Next.js, Docker).

Quy trinh 5 buoc:
  1. Pre-check QA       - chay test tu dong (pytest / npm test) neu co
  2. Build Assets       - build Docker image hoac build production (npm run build)
  3. Export Offline Bundle - dong goi moi thu can de cai dat KHONG CAN INTERNET
  4. Generate Installers   - sinh install.bat (Windows) va install.sh (Linux/Mac)
  5. Create Documentation  - sinh HUONG_DAN_CAI_DAT.md rieng cho tung loai du an

Su dung:
  python universal_packager.py --app-name lims-app --version 1.0.0
  python universal_packager.py --app-name crm-app --version 2.1.0 --skip-tests
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

NAME_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]*$")
SECRET_FILE_PATTERNS = (".env", ".env.local", ".env.production", ".env.development",
                         "credentials.json", "*.pem", "*.key")
JUNK_DIR_NAMES = {".git", "__pycache__", ".pytest_cache", ".mypy_cache",
                  "node_modules", "venv", ".venv", ".next", ".turbo"}


def log(msg: str) -> None:
    print(msg, flush=True)


def run(cmd: list[str], description: str, cwd: Path | None = None, check: bool = True) -> subprocess.CompletedProcess:
    log(f"[EXEC] {description}...")
    # Tren Windows, npm/pnpm/yarn la file .cmd (shell shim) chu khong phai .exe:
    # subprocess voi list arg (khong shell=True) khong tu tim thay chung qua PATH
    # (WinError 2), can shutil.which() de resolve dung duong dan thuc thi (no tu
    # xet ca PATHEXT nhu .CMD/.BAT tren Windows). Tren macOS/Linux day la no-op.
    resolved = shutil.which(cmd[0])
    exe = [resolved, *cmd[1:]] if resolved else cmd
    result = subprocess.run(exe, cwd=cwd, capture_output=True, text=True)
    if result.returncode != 0 and check:
        log(f"[ERROR] {description} that bai:\n{result.stderr}")
        sys.exit(1)
    log(f"[OK] {description} hoan tat.")
    return result


def validate_identifier(value: str, label: str) -> str:
    if not NAME_PATTERN.match(value):
        log(f"[ERROR] {label} khong hop le: '{value}'. Chi cho phep chu, so, '-', '_', '.'")
        sys.exit(1)
    return value


# ---------------------------------------------------------------------------
# Buoc 0: Nhan dien khung du an (framework detection)
# ---------------------------------------------------------------------------

def detect_stack(source_dir: Path) -> dict:
    """Tra ve dict mo ta khung du an duoc phat hien trong source_dir."""
    stack = {
        "docker": (source_dir / "docker-compose.yml").exists()
        or (source_dir / "docker-compose.prod.yml").exists(),
        "node": (source_dir / "package.json").exists(),
        "python": (source_dir / "requirements.txt").exists()
        or (source_dir / "pyproject.toml").exists(),
        "nextjs": False,
        "compose_file": None,
        "package_manager": "npm",
    }

    if stack["docker"]:
        stack["compose_file"] = (
            "docker-compose.prod.yml"
            if (source_dir / "docker-compose.prod.yml").exists()
            else "docker-compose.yml"
        )

    if stack["node"]:
        try:
            pkg = json.loads((source_dir / "package.json").read_text(encoding="utf-8"))
            deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
            stack["nextjs"] = "next" in deps
            stack["node_scripts"] = pkg.get("scripts", {})
        except (json.JSONDecodeError, OSError):
            stack["node_scripts"] = {}
        if (source_dir / "pnpm-lock.yaml").exists():
            stack["package_manager"] = "pnpm"
        elif (source_dir / "yarn.lock").exists():
            stack["package_manager"] = "yarn"

    return stack


def describe_stack(stack: dict) -> str:
    parts = []
    if stack["docker"]:
        parts.append(f"Docker ({stack['compose_file']})")
    if stack["node"]:
        parts.append("Next.js" if stack["nextjs"] else f"Node.js ({stack['package_manager']})")
    if stack["python"]:
        parts.append("Python")
    return " + ".join(parts) if parts else "Khong xac dinh (dong goi dang generic)"


# ---------------------------------------------------------------------------
# Buoc 1: Pre-check QA
# ---------------------------------------------------------------------------

def step1_qa_check(source_dir: Path, stack: dict, skip_tests: bool) -> None:
    log("\n=== BUOC 1/5: PRE-CHECK QA ===")
    if skip_tests:
        log("[SKIP] Bo qua kiem tra QA theo yeu cau (--skip-tests).")
        return

    ran_any = False
    if stack["python"] and ((source_dir / "pytest.ini").exists() or (source_dir / "tests").exists()):
        run(["pytest"], "Chay Python unit tests", cwd=source_dir)
        ran_any = True

    if stack["node"] and "test" in stack.get("node_scripts", {}):
        pm = stack["package_manager"]
        cmd = [pm, "test"] if pm != "npm" else ["npm", "test", "--", "--watchAll=false"]
        run(cmd, "Chay Node.js test suite", cwd=source_dir)
        ran_any = True

    if not ran_any:
        log("[INFO] Khong tim thay test suite phu hop, bo qua buoc QA.")


# ---------------------------------------------------------------------------
# Buoc 2: Build Assets
# ---------------------------------------------------------------------------

def step2_build_assets(source_dir: Path, stack: dict) -> None:
    log("\n=== BUOC 2/5: BUILD ASSETS ===")

    if stack["docker"]:
        run(
            ["docker-compose", "-f", stack["compose_file"], "build"],
            "Build Docker images",
            cwd=source_dir,
        )
        return

    if stack["node"] and "build" in stack.get("node_scripts", {}):
        pm = stack["package_manager"]
        cmd = [pm, "run", "build"] if pm != "npm" else ["npm", "run", "build"]
        run(cmd, "Build production assets (npm run build)", cwd=source_dir)
        return

    if stack["python"]:
        log("[INFO] Du an Python thuan (khong Docker): khong can buoc build rieng.")
        return

    log("[INFO] Khong phat hien buoc build can thiet, bo qua.")


# ---------------------------------------------------------------------------
# Buoc 3: Export Offline Bundle
# ---------------------------------------------------------------------------

def _copy_filtered(
    src: Path,
    dst: Path,
    extra_ignore: set[str] | None = None,
    exclude_paths: set[Path] | None = None,
) -> None:
    """Copy src -> dst, skipping junk/secret files and any path in exclude_paths.

    exclude_paths is compared by resolved absolute path rather than by name, so a
    project folder that happens to be named e.g. "dist" for unrelated reasons is not
    skipped — only the packager's own output directory is. This matters because the
    output directory is created under the source tree by default, and copying it into
    itself would recurse indefinitely.
    """
    ignore_names = JUNK_DIR_NAMES | (extra_ignore or set())
    resolved_excludes = {p.resolve() for p in (exclude_paths or set())}

    def ignore(current_dir, names):
        skip = set()
        current = Path(current_dir)
        for n in names:
            if n in ignore_names:
                skip.add(n)
                continue
            if (current / n).resolve() in resolved_excludes:
                skip.add(n)
                continue
            for pattern in SECRET_FILE_PATTERNS:
                if Path(n).match(pattern):
                    skip.add(n)
        return skip

    shutil.copytree(src, dst, ignore=ignore, dirs_exist_ok=True)


def step3_export_bundle(source_dir: Path, dist_dir: Path, stack: dict) -> None:
    log("\n=== BUOC 3/5: EXPORT OFFLINE BUNDLE ===")
    app_payload = dist_dir / "app"

    if stack["docker"]:
        images_result = run(
            ["docker-compose", "-f", stack["compose_file"], "config", "--images"],
            "Lay danh sach Docker images",
            cwd=source_dir,
        )
        images = [line.strip() for line in images_result.stdout.splitlines() if line.strip()]
        if images:
            tar_path = dist_dir / "app_images.tar"
            run(["docker", "save", "-o", str(tar_path), *images], "Xuat Docker images offline")
        shutil.copy2(source_dir / stack["compose_file"], dist_dir / "docker-compose.yml")
        return

    if stack["node"]:
        app_payload.mkdir(parents=True, exist_ok=True)
        for candidate in ("package.json", "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "next.config.js", "next.config.mjs"):
            f = source_dir / candidate
            if f.exists():
                shutil.copy2(f, app_payload / candidate)
        for build_dir in (".next", "build", "dist", "public"):
            d = source_dir / build_dir
            if d.exists() and d.resolve() != dist_dir.parent.resolve():
                _copy_filtered(d, app_payload / build_dir, exclude_paths={dist_dir.parent})
        node_modules = source_dir / "node_modules"
        if node_modules.exists():
            log("[INFO] Dong goi node_modules co san de cai dat that su offline (co the mat vai phut)...")
            _copy_filtered(node_modules, app_payload / "node_modules", exclude_paths={dist_dir.parent})
        else:
            log("[INFO] Khong tim thay node_modules — installer se chay npm install luc cai dat (can internet).")
        return

    if stack["python"]:
        app_payload.mkdir(parents=True, exist_ok=True)
        _copy_filtered(source_dir, app_payload, exclude_paths={dist_dir.parent})
        req_file = source_dir / "requirements.txt"
        if req_file.exists():
            vendor_dir = dist_dir / "python_packages"
            vendor_dir.mkdir(parents=True, exist_ok=True)
            run(
                [sys.executable, "-m", "pip", "download", "-r", str(req_file), "-d", str(vendor_dir)],
                "Tai truoc cac Python package de cai dat offline",
                check=False,
            )
        return

    log("[INFO] Khong nhan dien khung cu the — sao chep toan bo source code (loai tru file rac/secret).")
    app_payload.mkdir(parents=True, exist_ok=True)
    _copy_filtered(source_dir, app_payload, exclude_paths={dist_dir.parent})


# ---------------------------------------------------------------------------
# Buoc 4: Generate 1-Click Installers
# ---------------------------------------------------------------------------

def step4_generate_installers(dist_dir: Path, app_name: str, version: str, stack: dict) -> None:
    log("\n=== BUOC 4/5: GENERATE 1-CLICK INSTALLERS ===")

    if stack["docker"]:
        bat = (
            f"@echo off\n"
            f"echo DANG CAI DAT {app_name.upper()} v{version}...\n"
            f"docker load -i app_images.tar\n"
            f"docker-compose up -d\n"
            f"echo CAI DAT HOAN TAT!\n"
            f"pause\n"
        )
        sh = (
            f"#!/bin/bash\n"
            f"set -e\n"
            f"echo 'DANG CAI DAT {app_name.upper()} v{version}...'\n"
            f"docker load -i app_images.tar\n"
            f"docker-compose up -d\n"
            f"echo 'CAI DAT HOAN TAT!'\n"
        )
    elif stack["node"]:
        install_cmd = "npm install --omit=dev" if not (dist_dir / "app" / "node_modules").exists() else "echo Da co san node_modules, bo qua npm install"
        start_cmd = "npm start"
        bat = (
            f"@echo off\n"
            f"echo DANG CAI DAT {app_name.upper()} v{version}...\n"
            f"cd app\n"
            f"{install_cmd}\n"
            f"{start_cmd}\n"
            f"pause\n"
        )
        sh = (
            f"#!/bin/bash\n"
            f"set -e\n"
            f"echo 'DANG CAI DAT {app_name.upper()} v{version}...'\n"
            f"cd app\n"
            f"{install_cmd}\n"
            f"{start_cmd}\n"
        )
    elif stack["python"]:
        pip_cmd = "pip install --no-index --find-links=../python_packages -r requirements.txt" \
            if (dist_dir / "python_packages").exists() else "pip install -r requirements.txt"
        bat = (
            f"@echo off\n"
            f"echo DANG CAI DAT {app_name.upper()} v{version}...\n"
            f"cd app\n"
            f"python -m venv venv\n"
            f"call venv\\Scripts\\activate.bat\n"
            f"{pip_cmd}\n"
            f"echo CAI DAT HOAN TAT! Chay ung dung bang: venv\\Scripts\\python main.py\n"
            f"pause\n"
        )
        sh = (
            f"#!/bin/bash\n"
            f"set -e\n"
            f"echo 'DANG CAI DAT {app_name.upper()} v{version}...'\n"
            f"cd app\n"
            f"python3 -m venv venv\n"
            f"source venv/bin/activate\n"
            f"{pip_cmd}\n"
            f"echo 'CAI DAT HOAN TAT! Chay ung dung bang: venv/bin/python main.py'\n"
        )
    else:
        bat = (
            f"@echo off\n"
            f"echo Bo cai dat {app_name} v{version} khong co script tu dong.\n"
            f"echo Vui long xem HUONG_DAN_CAI_DAT.md de biet cach cai dat thu cong.\n"
            f"pause\n"
        )
        sh = (
            f"#!/bin/bash\n"
            f"echo 'Bo cai dat {app_name} v{version} khong co script tu dong.'\n"
            f"echo 'Vui long xem HUONG_DAN_CAI_DAT.md de biet cach cai dat thu cong.'\n"
        )

    (dist_dir / "install.bat").write_text(bat, encoding="utf-8")
    sh_path = dist_dir / "install.sh"
    sh_path.write_text(sh, encoding="utf-8", newline="\n")
    sh_path.chmod(0o755)
    log("[OK] Da tao install.bat va install.sh")


# ---------------------------------------------------------------------------
# Buoc 5: Create Documentation
# ---------------------------------------------------------------------------

def step5_create_documentation(dist_dir: Path, app_name: str, version: str, stack: dict) -> None:
    log("\n=== BUOC 5/5: CREATE DOCUMENTATION ===")

    requirements = ["Windows 10+/macOS/Linux"]
    if stack["docker"]:
        requirements.append("Docker Desktop (hoac Docker Engine + docker-compose) da cai san")
    if stack["node"] and not stack["docker"]:
        requirements.append(f"Node.js (kem {stack['package_manager']}) da cai san")
    if stack["python"] and not stack["docker"]:
        requirements.append("Python 3.9+ da cai san")

    doc = f"""# Huong dan cai dat — {app_name} v{version}

## Gioi thieu
Bo cai dat nay duoc dong goi tu dong boi Universal App Packager.
Khung du an duoc nhan dien: **{describe_stack(stack)}**

## Yeu cau he thong
{chr(10).join(f"- {r}" for r in requirements)}

## Cai dat
### Windows
Nhap dup vao `install.bat`, hoac chay trong Command Prompt:
```
install.bat
```

### macOS / Linux
```bash
chmod +x install.sh
./install.sh
```

## Go cai dat
{"- Chay `docker-compose down` trong thu muc nay." if stack["docker"] else "- Xoa thu muc cai dat va (neu co) moi truong ao venv/node_modules ben trong thu muc app/."}

## Ho tro
Neu gap loi trong qua trinh cai dat, gui lai thong bao loi hien tren man hinh cho doi ky thuat.
"""
    (dist_dir / "HUONG_DAN_CAI_DAT.md").write_text(doc, encoding="utf-8")
    log("[OK] Da tao HUONG_DAN_CAI_DAT.md")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Universal Software Packager CLI")
    parser.add_argument("--app-name", required=True, help="Ten ung dung (vd: lims-app, crm-app)")
    parser.add_argument("--version", default="1.0.0", help="Phien ban dong goi")
    parser.add_argument("--source-dir", default=".", help="Thu muc goc du an can dong goi (mac dinh: thu muc hien tai)")
    parser.add_argument("--skip-tests", action="store_true", help="Bo qua buoc chay test (QA)")
    args = parser.parse_args()

    app_name = validate_identifier(args.app_name, "--app-name")
    version = validate_identifier(args.version, "--version")
    source_dir = Path(args.source_dir).resolve()

    if not source_dir.exists():
        log(f"[ERROR] Khong tim thay thu muc du an: {source_dir}")
        sys.exit(1)

    final_dist_dir = Path("dist") / f"{app_name}_v{version}"

    # Dong goi vao mot thu muc tam thoi ngoai source_dir truoc, roi moi chuyen vao
    # final_dist_dir o buoc cuoi. Ly do: final_dist_dir thuong nam ngay trong (hoac
    # canh) source_dir, va ten "dist" cung la ten thu muc build output pho bien cua
    # Node (Vite/webpack/tsc). Neu ghi truc tiep vao final_dist_dir tu dau, cac buoc
    # sao chep toan bo source_dir (Python/generic) hoac sao chep thu muc build "dist"
    # cua Node co the tu sao chep chinh no vao chinh no.
    stage_dir = Path(tempfile.mkdtemp(prefix=f"{app_name}_pkg_"))
    try:
        log(f"BAT DAU DONG GOI UNG DUNG: {app_name} (v{version})")
        log(f"Thu muc nguon: {source_dir}")

        stack = detect_stack(source_dir)
        log(f"Khung du an phat hien: {describe_stack(stack)}")

        step1_qa_check(source_dir, stack, args.skip_tests)
        step2_build_assets(source_dir, stack)
        step3_export_bundle(source_dir, stage_dir, stack)
        step4_generate_installers(stage_dir, app_name, version, stack)
        step5_create_documentation(stage_dir, app_name, version, stack)

        if final_dist_dir.exists():
            shutil.rmtree(final_dist_dir)
        final_dist_dir.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(stage_dir), str(final_dist_dir))
    finally:
        if stage_dir.exists():
            shutil.rmtree(stage_dir, ignore_errors=True)

    log(f"\nTAO BO CAI DAT THANH CONG TAI: {final_dist_dir.resolve()}")


if __name__ == "__main__":
    main()
