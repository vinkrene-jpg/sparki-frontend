# UX_00B-R1 — CORRECTIEOPDRACHT

```yaml
supersedes:
  - docs/UX_00B_FIGMA_CODE_MAPPING.yaml
reason:
  - PREVIOUS_DELIVERY_MAPPED_OLD_UX_00A_BASELINE
  - PREVIOUS_DELIVERY_MAPPED_0_OF_8_APPROVED_FIGMA_FRAMES

authoritative_inputs:
  contract: SPARKI_COMMERCIAL_UX_CONTRACT_v1.0.yaml
  instruction: UX_00B_REPLIT_FIGMA_CODE_MAPPING_INSTRUCTION.md
  screenshots_directory: approved_figma_frames/
  screenshot_count: 8

mandatory_mapping:
  - "34:2 | GO_ROUTE_HOME_MOBILE"
  - "34:3 | GO_ROUTE_WORKSPACE_DESKTOP"
  - "34:4 | GO_ROUTE_DETAIL_MOBILE"
  - "34:5 | COMPLETE_TODAY_MOBILE"
  - "34:6 | COMPLETE_TODAY_DESKTOP"
  - "34:7 | COMPLETE_PLAN_DESKTOP"
  - "34:8 | SHARED_ONBOARDING_MOBILE"
  - "34:9 | SHARED_SUBSCRIPTION_DESKTOP"

execution:
  mode: READ_ONLY
  timebox_minutes: 30
  required:
    - MAP_EXACTLY_ALL_8_APPROVED_SCREENSHOTS_TO_VERIFIED_CURRENT_CODE
    - USE_NODE_IDS_AND_FRAME_NAMES_AS_PROVEN_METADATA_FROM_CONTRACT
    - CLASSIFY_EACH_ELEMENT_AS_REUSE_ADAPT_OR_NEW
    - DEFINE_ONE_SMALLEST_SAFE_UX_01_INCREMENT
  prohibited:
    - MAP_OLD_UX_00A_AS_TARGET_DESIGN
    - DECLARE_FIGMA_FRAMES_ABSENT
    - PRODUCTION_CODE_CHANGE
    - FEATURE_BUILD
    - NEW_PROJECT
    - ARCHITECT_AGENT
    - EXTERNAL_RESEARCH
    - EVIDENCE_ZIP

deliverable:
  replace: docs/UX_00B_FIGMA_CODE_MAPPING.yaml
  minimum:
    - repository_head_branch_cleanliness
    - mapping_count_8_of_8
    - per_frame_route_entry_components_tokens_data_auth_tests
    - per_element_reuse_adapt_new
    - exact_UX_01_scope_files_tests_rollback
    - worktree_unchanged_except_single_deliverable

completion_response:
  max_lines: 10
  stop_after_delivery: true
```
