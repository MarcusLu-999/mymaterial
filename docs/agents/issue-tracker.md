# Issue Tracker Configuration

This repository tracks issues locally using markdown files.

## Location
Issues are stored as markdown files in the `.scratch/tickets/` directory.

## Structure
Each ticket is a markdown file with metadata frontmatter:
- `id`: Unique identifier (e.g., ticket-001)
- `title`: Short title
- `status`: one of `todo`, `in-progress`, `done`
- `assigned_to`: agent role or developer name

## Tool Integration
The engineering skills will read and write local markdown files under `.scratch/tickets/` instead of calling remote APIs.
