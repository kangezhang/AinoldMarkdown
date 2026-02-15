# Implementation Plan

## Goal

Build a Typora-like Markdown editor with phased delivery and measurable acceptance criteria.

## Phase 1 (Implemented in this repo)

### Scope

- Editor core with WYSIWYG-like single-pane editing
- Open `.md` file
- Save `.md` file
- Basic Markdown shortcuts (`#`, `-`, `>`)

### Acceptance

- Can open a markdown file and render editable content
- Can modify content and save back to markdown
- Keyboard shortcuts are functional for headings/lists/blockquote

## Phase 2 (Next)

- Task list checkbox behavior (implemented)
- Table editing UX (tab navigation and cell editing) (implemented baseline)
- Image paste/drag and local assets management (implemented baseline)
- Code block syntax highlighting (implemented)
- In-document search (implemented)

## Phase 3

- Theme package (`theme.json` + `theme.css`)
- Runtime theme switch
- Export HTML with same theme

## Phase 4

- Export PDF from HTML print pipeline
- Heading outline and navigation
- Large document performance optimization

## Milestones

- M1: Editable and saveable markdown (Phase 1)
- M2: Practical writing UX with table/image/task list (Phase 2)
- M3: Theme and HTML export consistency (Phase 3)
- M4: PDF + outline + large-doc stability (Phase 4)
