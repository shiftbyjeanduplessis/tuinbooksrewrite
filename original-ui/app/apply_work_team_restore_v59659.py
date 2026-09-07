#!/usr/bin/env python3
"""
TuinBooks v59.6.59 — Work Team Board Restore patcher

Usage:
    python apply_work_team_restore_v59659.py /path/to/TUINBOOKS-main
or:
    python apply_work_team_restore_v59659.py /path/to/app/app.js

The patch is deliberately source-level and additive. It refuses to run if the
v59.6.54 team-board implementation is not present, so it cannot silently
rebuild Work against an incompatible/stale app.js.
"""

from pathlib import Path
import sys, shutil, re, json

BUILD = "59.6.59-work-team-board-restore"
MARKERS = [
    "59.6.54-work-team-operations-board",
    "function renderWorkControlV59386",
    "function workTeamBoardCardV59654",
    "function workTeamSectionV59654",
    "function workTeamsForItemsV59654",
    "function exposeLegacyPatchBridgeV58951",
]

RESTORE_BLOCK = r"""
/* =========================================================
   TuinBooks v59.6.59 — Work team-board ownership restore
   ---------------------------------------------------------
   Purpose
   - Restore v59.6.54 "Today · team control" as the authoritative
     Recent Work renderer.
   - Keep the agreed Work tabs: Recent Work / Needs Review / All Work.
   - Remove the later Orders injection from Work.
   - Do not touch cloud save, Supabase hydration, schedules, billing,
     invoices, or the v59.6.58 Billing Profile repair.
   ========================================================= */
const TUINBOOKS_WORK_RESTORE_V59659='59.6.59-work-team-board-restore';

function removeOrdersFromWorkV59659(){
  document
    .querySelectorAll('#view-records [data-work-tab-v58930="orders"]')
    .forEach(node=>node.remove());
  const count=document.getElementById('ordersCountV58940');
  if(count?.closest('[data-work-tab-v58930="orders"]'))count.closest('[data-work-tab-v58930="orders"]').remove();
}

/* Stock-order data can continue to exist for quote fulfilment.
   It simply no longer owns a tab inside Work. */
try{
  ensureOrdersTabV58940=function ensureOrdersTabDisabledV59659(){
    removeOrdersFromWorkV59659();
  };
}catch(error){}

/* Any stale cached onclick from the removed Orders tab falls back safely. */
window.setWorkOrdersTabV58940=function setWorkOrdersTabDisabledV59659(){
  applyWorkTabV58930('recent');
};

function renderRecentWorkV59659(){
  renderWorkControlV59386({all:false});
  document.getElementById('needsResolutionV56')?.classList.add('hidden');
}

function renderAllWorkV59659(){
  renderWorkControlV59386({all:true});
  document.getElementById('needsResolutionV56')?.classList.add('hidden');
}

/* Make the restored team-board renderer the final owner. */
renderRecords=function renderRecordsV59659(){
  renderRecentWorkV59659();
};
renderAllWorkV58930=function renderAllWorkV59659Final(){
  renderAllWorkV59659();
};

applyWorkTabV58930=function applyWorkTabV59659(tab){
  const next=['recent','needs-review','all'].includes(String(tab||''))
    ? String(tab)
    : 'recent';

  workTabV58930=next;
  removeOrdersFromWorkV59659();

  setActiveSubtabV58930(
    '[data-work-tab-v58930]',
    next,
    'data-work-tab-v58930'
  );

  const view=document.getElementById('view-records');
  const inline=document.getElementById('needsReviewInlineV58930');
  const toolbar=view?.querySelector('.toolbar');
  const host=document.getElementById('workRecordCards');

  if(next==='needs-review'){
    /* Refresh the authoritative exception source, then show it only
       in the dedicated Needs Review tab. */
    renderWorkControlV59386({all:false});
    const source=document.getElementById('needsResolutionV56');

    if(inline){
      inline.innerHTML=
        source?.innerHTML||
        '<div class="ui-empty">No work needs an office decision.</div>';
      inline.classList.remove('hidden');
    }

    source?.classList.add('hidden');
    toolbar?.classList.add('hidden');
    host?.classList.add('hidden');
    return;
  }

  inline?.classList.add('hidden');
  toolbar?.classList.remove('hidden');
  host?.classList.remove('hidden');

  if(next==='all')renderAllWorkV59659();
  else renderRecentWorkV59659();
};

/* Defensive cleanup: quote initialisation can run at DOMContentLoaded. */
function initialiseWorkRestoreV59659(){
  removeOrdersFromWorkV59659();

  /* If Work is already the visible page, repaint it immediately.
     Otherwise normal navigation will call the restored owner. */
  if(document.getElementById('view-records')?.classList.contains('active')){
    applyWorkTabV58930(
      ['recent','needs-review','all'].includes(workTabV58930)
        ? workTabV58930
        : 'recent'
    );
  }

  window.__tuinbooksWorkTeamBoardBuild='59.6.54-work-team-operations-board';
  window.__tuinbooksWorkRestoreBuild=TUINBOOKS_WORK_RESTORE_V59659;
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',initialiseWorkRestoreV59659);
}else{
  initialiseWorkRestoreV59659();
}
"""

def locate_app_js(arg: str) -> Path:
    p = Path(arg).expanduser().resolve()
    if p.is_file():
        return p
    candidates = [p / "app" / "app.js", p / "app.js"]
    for c in candidates:
        if c.exists():
            return c
    raise SystemExit(f"Could not find app/app.js under: {p}")

def insert_before_iife_close(text: str, block: str) -> str:
    # Main TuinBooks app.js is one outer IIFE. Insert before its final closure.
    idx = text.rfind("})();")
    if idx < 0:
        raise SystemExit("Safety stop: final outer IIFE closure '})();' was not found.")
    return text[:idx] + "\n\n" + block.strip() + "\n\n" + text[idx:]

def patch_all_work_today(text: str) -> tuple[str, bool]:
    old = "const previous=[...groups.entries()].filter(([date])=>date!==today).sort((a,b)=>b[0].localeCompare(a[0]));"
    new = "const previous=[...groups.entries()].filter(([date])=>all||date!==today).sort((a,b)=>b[0].localeCompare(a[0]));"
    if old in text:
        return text.replace(old, new, 1), True
    if new in text:
        return text, False
    raise SystemExit(
        "Safety stop: expected v59.6.54 previous-work grouping line was not found. "
        "The source differs from the recovered build, so no patch was applied."
    )

def patch_version_file(repo_root: Path):
    version = repo_root / "app" / "VERSION.txt"
    if version.exists():
        version.write_text(BUILD + "\n", encoding="utf-8")

def patch_service_worker(repo_root: Path):
    sw = repo_root / "app" / "service-worker.js"
    if not sw.exists():
        return False
    text = sw.read_text(encoding="utf-8")
    if BUILD in text:
        return False

    # Safest generic cache bust: replace the first quoted cache/version token
    # that already contains a TuinBooks version, without restructuring SW logic.
    patterns = [
        r"""(['"])([^'"]*59\.6\.58[^'"]*)\1""",
        r"""(['"])([^'"]*v59\.6\.58[^'"]*)\1""",
    ]
    for pat in patterns:
        m = re.search(pat, text, flags=re.I)
        if m:
            replacement = f"{m.group(1)}{BUILD}{m.group(1)}"
            text = text[:m.start()] + replacement + text[m.end():]
            sw.write_text(text, encoding="utf-8")
            return True
    return False

def main():
    if len(sys.argv) != 2:
        raise SystemExit(
            "Usage: python apply_work_team_restore_v59659.py "
            "/path/to/TUINBOOKS-main-or-app.js"
        )

    app_js = locate_app_js(sys.argv[1])
    original = app_js.read_text(encoding="utf-8")

    missing = [m for m in MARKERS if m not in original]
    if missing:
        raise SystemExit(
            "Safety stop: this app.js does not contain the recovered v59.6.54 "
            "Work team board.\nMissing markers:\n- " + "\n- ".join(missing)
        )

    if BUILD in original:
        print(json.dumps({
            "status": "already_patched",
            "app_js": str(app_js),
            "build": BUILD
        }, indent=2))
        return

    patched, all_work_changed = patch_all_work_today(original)
    patched = insert_before_iife_close(patched, RESTORE_BLOCK)

    backup = app_js.with_suffix(".js.before-v59659.bak")
    shutil.copy2(app_js, backup)
    app_js.write_text(patched, encoding="utf-8")

    repo_root = app_js.parent.parent if app_js.parent.name == "app" else app_js.parent
    patch_version_file(repo_root)
    sw_changed = patch_service_worker(repo_root)

    checks = {
        "team_board_marker": "59.6.54-work-team-operations-board" in patched,
        "restore_marker": BUILD in patched,
        "orders_disabled": "ensureOrdersTabDisabledV59659" in patched,
        "authoritative_apply_work": "function applyWorkTabV59659" in patched,
        "all_work_includes_today": "filter(([date])=>all||date!==today)" in patched,
        "cloud_save_text_not_removed": len(patched) > len(original),
    }

    if not all(checks.values()):
        # Restore automatically on failed static checks.
        shutil.copy2(backup, app_js)
        raise SystemExit("Static verification failed. Original app.js was restored.")

    print(json.dumps({
        "status": "patched",
        "build": BUILD,
        "app_js": str(app_js),
        "backup": str(backup),
        "all_work_today_fix_applied": all_work_changed,
        "service_worker_cache_bumped": sw_changed,
        "checks": checks,
    }, indent=2))

if __name__ == "__main__":
    main()
