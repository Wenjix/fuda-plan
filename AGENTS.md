

<!-- br-agent-instructions-v1 -->

---

## Beads Workflow Integration

This project uses [beads_rust](https://github.com/Dicklesworthstone/beads_rust) (`br`/`bd`) for issue tracking. Issues are stored in `.beads/` and tracked in git.

### Essential Commands

```bash
# View ready issues (unblocked, not deferred)
br ready              # or: bd ready

# List and search
br list --status=open # All open issues
br show <id>          # Full issue details with dependencies
br search "keyword"   # Full-text search

# Create and update
br create --title="..." --description="..." --type=task --priority=2
br update <id> --status=in_progress
br close <id> --reason="Completed"
br close <id1> <id2>  # Close multiple issues at once

# Sync with git
br sync --flush-only  # Export DB to JSONL
br sync --status      # Check sync status
```

### Workflow Pattern

1. **Start**: Run `br ready` to find actionable work
2. **Claim**: Use `br update <id> --status=in_progress`
3. **Work**: Implement the task
4. **Complete**: Use `br close <id>`
5. **Sync**: Always run `br sync --flush-only` at session end

### Key Concepts

- **Dependencies**: Issues can block other issues. `br ready` shows only unblocked work.
- **Priority**: P0=critical, P1=high, P2=medium, P3=low, P4=backlog (use numbers 0-4, not words)
- **Types**: task, bug, feature, epic, chore, docs, question
- **Blocking**: `br dep add <issue> <depends-on>` to add dependencies

### Session Protocol

**Before ending any session, run this checklist:**

```bash
git status              # Check what changed
git add <files>         # Stage code changes
br sync --flush-only    # Export beads changes to JSONL
git commit -m "..."     # Commit everything
git push                # Push to remote
```

### Project Structure

This project has **200 beads** (33 epics + 167 tasks) organized by implementation phase:

| Phase | Priority | Description | Epics |
|-------|----------|-------------|-------|
| 0 | P0 | Foundation: types, FSMs, traversal, persistence, tests | E01-E10 |
| 1 | P1 | Single-lane: stores, pipeline, prompts, streaming, UI | E11-E20 |
| 2 | P1 | Socratic dialogue: prompt builder, mode templates, UI | E21-E22 |
| 3 | P1 | Multi-lane: lanes, promotion, lane plans | E23-E25 |
| 4 | P2 | Unified synthesis: map-reduce, evidence trail | E26-E28 |
| 5 | P2-P4 | Polish: workspace, export, settings, errors, perf | E29-E33 |

**Critical path**: Scaffolding -> Types -> FSMs + Traversal + Quality Gates -> Context Compiler + Persistence -> Stores + Pipeline + Prompts -> UI + Streaming -> Dialogue -> Lanes/Promotion -> Synthesis -> Polish

### Label Convention

- **Phase labels**: `phase-0` through `phase-5`
- **Domain labels**: `core`, `types`, `fsm`, `graph`, `validation`, `persistence`, `store`, `generation`, `ui`, `testing`, `infra`, `export`, `error-handling`, `performance`

### Spec Reference

The full implementation specification is at `fuda-plan/docs/plans/plan_for_fuda.md` (2590 lines). Always reference this when implementing a task - it contains file paths, interface shapes, FSM tables, and acceptance criteria.

### Known br CLI Issues

- **Do NOT use `br dep add` in bulk** - v0.1.20 has a SQLite B-tree corruption bug after ~30 consecutive dep operations. Dependencies were loaded via JSONL patching.
- Use `br sync --flush-only` instead of `br sync` to avoid import conflicts.

### Best Practices

- Check `br ready` at session start to find available work
- Update status as you work (in_progress -> closed)
- Create new issues with `br create` when you discover tasks
- Use descriptive titles and set appropriate priority/type
- Always sync before ending session
- Reference the plan spec line numbers when implementation details are unclear

<!-- end-br-agent-instructions -->
