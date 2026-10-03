"""Extract only policy-pinned licenses from exact upstream Keycloak JARs."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys
from zipfile import ZipFile


def extract_evidence(policy_path, rootfs, evidence_dir):
    policy = json.loads(Path(policy_path).read_text())
    if policy.get("schemaVersion") != 1 or not isinstance(policy.get("components"), list):
        raise ValueError("unsupported embedded license policy")
    rootfs = Path(rootfs)
    evidence_dir = Path(evidence_dir)
    for root in (rootfs, evidence_dir):
        if root.is_symlink() or not root.is_dir():
            raise ValueError("unsafe evidence root")
    rootfs = rootfs.resolve(strict=True)
    evidence_dir = evidence_dir.resolve(strict=True)
    pending = []
    selected = set()
    for component in policy["components"]:
        name = component["name"]
        version = component["version"]
        jar_path = component["sourceJarPath"]
        if (not re.fullmatch(r"[A-Za-z0-9._-]+", name)
                or not re.fullmatch(r"[A-Za-z0-9._-]+", version)
                or not re.fullmatch(r"/opt/keycloak/lib/lib/(main|deployment)/[A-Za-z0-9._-]+\.jar", jar_path)):
            raise ValueError("unsafe embedded license policy path")
        source = rootfs / jar_path.lstrip("/")
        if source.is_symlink() or not source.is_file() or not source.resolve().is_relative_to(rootfs):
            raise ValueError("unsafe source JAR")
        if hashlib.sha256(source.read_bytes()).hexdigest() != component["sourceJarSha256"]:
            raise ValueError(f"source JAR sha256 mismatch: {name}")
        entries = component["entries"]
        if not isinstance(entries, list) or not entries:
            raise ValueError("embedded license entries required")
        with ZipFile(source) as archive:
            names = archive.namelist()
            for entry in entries:
                path = entry["path"]
                if not re.fullmatch(r"(META-INF/)?(LICENSE|NOTICE)", path):
                    raise ValueError("unsafe embedded license entry")
                if names.count(path) != 1:
                    raise ValueError(f"exactly one {path} entry is required")
                info = archive.getinfo(path)
                if info.file_size <= 0 or info.file_size > 1024 * 1024:
                    raise ValueError("embedded license entry size is unsafe")
                data = archive.read(path)
                if hashlib.sha256(data).hexdigest() != entry["sha256"]:
                    raise ValueError(f"license evidence sha256 mismatch: {name}/{path}")
                target = evidence_dir / "embedded-jars" / f"{name}-{version}" / path
                if target in selected or target.exists() or target.is_symlink() or not target.resolve().is_relative_to(evidence_dir):
                    raise ValueError("unsafe or duplicate license evidence target")
                selected.add(target)
                pending.append((target, data, f"{jar_path.lstrip('/')}!/{path}"))
    # Verify every selection before writing any entry; never extract arbitrary ZIP paths.
    for target, data, label in pending:
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open("xb") as destination:
            destination.write(data)
        print(label)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--policy", required=True)
    parser.add_argument("--rootfs", required=True)
    parser.add_argument("--evidence-dir", required=True)
    options = parser.parse_args()
    try:
        extract_evidence(options.policy, options.rootfs, options.evidence_dir)
    except (OSError, ValueError, KeyError) as error:
        print(f"Keycloak embedded license evidence: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
