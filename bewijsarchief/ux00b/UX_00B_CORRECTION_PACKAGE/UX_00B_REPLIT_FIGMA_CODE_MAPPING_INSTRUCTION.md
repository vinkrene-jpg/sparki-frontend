# UX_00B — FIGMA_TO_EXISTING_CODE_MAPPING_ONLY

```yaml
task:
  id: UX_00B
  mode: READ_ONLY
  objective: MAP_APPROVED_FIGMA_WAVE_1_TO_CURRENT_REPOSITORY
  timebox_minutes: 30
  stop_after_deliverable: true

authority:
  ux_contract: SPARKI_COMMERCIAL_UX_CONTRACT_v1.0.yaml
  figma:
    file_key: Ru9gEfRRI2hMlO7psxrDrN
    wave_1_page_node: "5:9"
    approved_frames:
      GO_ROUTE_HOME_MOBILE: "34:2"
      GO_ROUTE_WORKSPACE_DESKTOP: "34:3"
      GO_ROUTE_DETAIL_MOBILE: "34:4"
      COMPLETE_TODAY_MOBILE: "34:5"
      COMPLETE_TODAY_DESKTOP: "34:6"
      COMPLETE_PLAN_DESKTOP: "34:7"
      SHARED_ONBOARDING_MOBILE: "34:8"
      SHARED_SUBSCRIPTION_DESKTOP: "34:9"

scope:
  required:
    - VERIFY_CURRENT_HEAD_AND_CLEANLINESS
    - MAP_EACH_FRAME_TO_REAL_ROUTES_ENTRY_COMPONENTS_CHILD_COMPONENTS_AND_STYLES
    - MAP_EXISTING_NAVIGATION_SHELL_RESPONSIVE_LOGIC_AND_THEME_TOKENS
    - MAP_EXISTING_DATA_HOOKS_APIS_AUTH_PERMISSIONS_FLAGS_AND_ENTITLEMENTS_USED_BY_EACH_FRAME
    - CLASSIFY_EACH_REQUIRED_UI_ELEMENT_AS REUSE | ADAPT | NEW
    - IDENTIFY_EXACT_TESTS_AND_VISUAL_REGRESSION_TARGETS
    - DEFINE_SMALLEST_SAFE_UX_01_IMPLEMENTATION_INCREMENT
  prohibited:
    - SOURCE_CODE_CHANGE
    - UI_CHANGE
    - SCHEMA_OR_API_CHANGE
    - DEPENDENCY_CHANGE
    - NEW_PROJECT
    - FIGMA_CODE_IMPORT
    - FEATURE_BUILD
    - RESEARCH_OUTSIDE_REPOSITORY_AND_GIVEN_FIGMA
    - ARCHITECT_SUBAGENT
    - BENCHMARK_OR_EVIDENCE_ZIP
    - REPEATED_REPORT_REWRITES

deliverable:
  path: docs/UX_00B_FIGMA_CODE_MAPPING.yaml
  schema:
    repository_state:
      - head_sha
      - branch
      - worktree_before
      - worktree_after
    frame_mapping:
      per_frame:
        - figma_node_id
        - current_route
        - entry_component_path
        - reusable_component_symbols
        - styles_or_tokens
        - data_and_service_dependencies
        - auth_permission_flag_entitlement_dependencies
        - reuse_adapt_new_decisions
        - verified_gaps
        - relevant_tests
    shared_shell_mapping:
      - mobile_navigation
      - desktop_navigation
      - responsive_breakpoints
      - light_dark_system_theme
    UX_01:
      - exact_scope
      - exact_files_expected_to_change
      - explicit_non_scope
      - acceptance_tests
      - rollback_boundary
      - estimated_replit_effort_band
    blockers:
      - only_evidence_based_blockers

acceptance:
  - ALL_8_FRAMES_MAPPED
  - NO_ASSUMED_PATHS_OR_SYMBOLS
  - EVERY_REUSE_ADAPT_NEW_DECISION_HAS_REPOSITORY_EVIDENCE
  - UX_01_IS_ONE_BOUNDED_IMPLEMENTATION_INCREMENT
  - WORKTREE_UNCHANGED
  - SINGLE_DELIVERABLE_ONLY

completion_response:
  max_lines: 12
  include:
    - deliverable_path
    - head_sha
    - worktree_unchanged
    - mapping_complete_count
    - UX_01_scope_summary
    - blockers
  exclude:
    - narrative_process_log
    - repeated_evidence
    - follow_up_execution_without_RENE_APPROVAL
```
