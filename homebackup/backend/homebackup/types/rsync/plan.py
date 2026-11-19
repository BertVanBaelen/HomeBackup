"""Generic rsync: copy the source folder into <target>/<target_path>/."""


def steps(item: dict, ctx: dict) -> list[dict]:
    argv = ["rsync", *ctx["rsync_flags"].split(), "--info=progress2", "--outbuf=L", "--stats", "--mkpath"]
    if item["delete"]:
        argv.append("--delete")  # only inside the synced folder: rsync never touches anything above it
    if ctx["dry_run"]:
        argv.append("--dry-run")
    argv += [item["source"].rstrip("/") + "/", f"{ctx['mount']}/{item['target_path'].strip('/')}/"]
    return [{"title": {"code": "step_copy"}, "why": {"code": "why_copy"}, "argv": argv}]
