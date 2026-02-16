

# Export Product Documentation as Markdown Files

## Overview
Create two structured markdown files from the product documentation previously generated:
1. **Confluence wiki document** - Full product documentation formatted for Confluence import
2. **Jira import file** - Epics and User Stories in a CSV-compatible format for Jira bulk import

## Files to Create

### 1. `docs/docflow-confluence-documentation.md`
Complete product documentation structured with Confluence-compatible markdown headings:
- System Overview and Architecture
- Feature Mapping by Domain (all EPICs)
- Business Rules
- Permissions and Roles Matrix
- Data Model Summary
- Technical Constraints
- Test Scenarios
- Gaps and Risks

### 2. `docs/docflow-jira-import.csv`
CSV file formatted for Jira bulk import with columns:
- Issue Type (Epic / Story)
- Summary
- Description
- Acceptance Criteria
- Epic Link
- Labels
- Priority

This covers all 14 EPICs and their associated User Stories extracted from the codebase analysis.

## Content Source
All content is derived from the codebase exploration already performed -- no new analysis needed. The documentation will reflect only currently implemented features with no fabricated roadmap items.

