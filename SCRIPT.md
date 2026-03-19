# FlowSentrix 2:30 Demo Script

## Goal (what you’ll prove)

1. A new workflow can be created and JSON-validated.
2. A run can execute normally (no healing).
3. A run can self-heal and still generate an autopsy + Slack notifications.
4. A run can escalate to HITL when healing can’t recover (and then resume).
5. A security pipeline can open a PR in the demo repo and post to Slack.

## Pre-demo checklist (do this before you start recording)

- Slack: at least these channels exist and the bot can post:
  - `#security-alerts`
  - `#ops-alerts`
- Email:
  - Set `MOCK_SMTP=false`
  - Set `RESEND_API_KEY`
  - Set `EMAIL_DEMO_RECIPIENT`
- GitHub:
  - Set `MOCK_GITHUB=false`
  - Set `GITHUB_TOKEN` with write permissions on your demo repo
  - Ensure `GITHUB_DEMO_REPO_OWNER` + `GITHUB_DEMO_REPO_NAME` point to the repo you want the PR in
- Groq:
  - Keep Groq real inference enabled for the HITL part (so healing can actually fail due to rate limits / upstream issues).
- Open these tabs so you can cut quickly during the recording:
  - Dashboard (so the `/?run=...` page loads instantly)
  - Slack workspace (ready on `#security-alerts` and `#ops-alerts`)
  - GitHub demo repo page (ready to refresh and show the new PR)

## On-screen URLs (keep memorized)

- Documentation: `http://localhost:5174/docs/`
- Swagger UI: `http://localhost:3000/docs`

## Workflow JSON import (what you paste once)

### A) Minimal “Healing Demo Workflow” (used to show self-healing + autopsy + Slack ops)

Use this JSON in the Workflow Builder `Import` modal.

> Paste exactly as-is.

```json
{
  "name": "Healing Demo Workflow (JSON Import)",
  "trigger": {
    "type": "Manual",
    "config": {}
  },
  "steps": [
    { "agentType": "PolicyAgent" },
    { "agentType": "LogicAgent" },
    { "agentType": "AnomalyAgent" }
  ],
  "confidence_thresholds": {
    "global": 90
  }
}
```

What this does:
- It gives you a multi-step workflow that is likely to produce at least one low-confidence step.
- The system healing path will still generate an autopsy and post to `#ops-alerts` via the built-in autopsy pipeline.

### B) Payload JSONs you’ll use (copy/paste into “Initial Payload (JSON)”)

**Security pipeline payload (for PR + Slack security channel):**
```json
{
  "repo_owner": "flowsentrix",
  "repo_name": "flowsentrix-demo",
  "affected_file": "src/api/client.ts",
  "cve_id": "CVE-2024-0001",
  "severity_score": 9.1,
  "vulnerability_id": 1
}
```

**Healing workflow payload (for healing + autopsy + ops slack):**
```json
{
  "task": "Run a reliability check and produce a structured summary. If anything seems uncertain, self-correct.",
  "notes": "Demo payload: keep outputs deterministic but allow the confidence scorer to exercise write-gate + healing."
}
```

## 2:30 Timeline (script + exact clicks + voiceover)

### 0:00 - 0:15 — Hook (system one-liner)
**On screen:** Dashboard home
**Voiceover:**  
“FlowSentrix is a self-healing workflow engine. Every step is confidence-scored, and if confidence is too low the system doesn’t just retry—it diagnoses, time-travels back with snapshots, and generates an autopsy.

In our adversarial stress tests: 114 runs, 25% success, an average heal time of 2.5 seconds, and only 8% that needed HITL. That low success rate is the point—it’s rigorous. And the recovery is fast.

Today I’ll show a clean run, a self-heal run, and a HITL escalation that resumes execution.”

### 0:15 - 0:40 — Create new workflow + direct JSON validation
**On screen:** Workflows tab → `+ Create Workflow` → Workflow Builder
**Clicks / actions:**
1. Open the Workflow Builder.
2. Click `Import`.
3. Paste the “Healing Demo Workflow (JSON Import)” JSON.
4. Click `Validate` (this is the direct dry-run JSON validation).
5. Confirm the UI shows validation success (Validation passed).
6. Click `Save & Register`.
**Voiceover:**  
“First: we create a brand-new workflow using direct JSON import. Then we run hard validation before saving—so we know the config is acceptable to the backend.”

### 0:40 - 1:05 — Execute workflow: “no healing” baseline
**On screen:** Header → `New Run` modal
**Clicks / actions:**
1. Click `New Run`.
2. Select the seeded workflow `security_scan_pipeline` (Code Vulnerability Auto-Remediation).
3. Paste the Security pipeline payload.
4. Click `Execute`.
**Voiceover:**  
“Now I trigger the security pipeline with a payload. This run is intended to complete normally—watch the event log and Healing Events tab: no `HEAL_REQUIRED` events.”

**During the run:**  
Keep eyes on Slack `#security-alerts` for the security message containing the PR URL.

### 1:05 - 1:30 — Show PR + branch + Slack security channel
**On screen:** GitHub demo repo + Slack `#security-alerts`
**Clicks / actions:**
1. Refresh GitHub.
2. Show the new branch and the newly created PR.
3. Return to Slack and point at the security message that includes the PR link.
**Voiceover:**  
“And we can show real artifacts: a new branch and an actual PR in the demo repo. At the same time, Slack gets a rich security alert containing the PR URL.”

### 1:30 - 1:55 — Execute workflow: self-healing + autopsy + ops Slack
**On screen:** Header → `New Run`
**Clicks / actions:**
1. Click `New Run`.
2. Select `Healing Demo Workflow (JSON Import)`.
3. Paste the healing workflow payload JSON.
4. Click `Execute`.
5. On the dashboard, open the Run details:
   - Event Log tab: show `HEAL_REQUIRED` and `HEALER_ACTIVATED`.
   - Healing Events tab: show diagnosis + execution strategy.
6. Open the autopsy section (collapsible on the dashboard).
7. Switch to Slack `#ops-alerts`.
**Voiceover:**  
“Now the fun part: this run triggers self-healing. You’ll see `HEAL_REQUIRED`, then the healer runs diagnosis and retries. Once healing is attempted, FlowSentrix generates an autopsy and posts the summary and PDF to `#ops-alerts`.”
“And this is backed by the Slack integration guide in the docs—channel mapping and interactive message behavior are documented under the Slack integration pages.”
“You’re seeing multiple Slack channels live: `#security-alerts` from the security pipeline and `#ops-alerts` from the autopsy pipeline.”

### 1:55 - 2:20 — Run where healing fails → HITL + email + Slack
**On screen:** Dashboard + Slack `#ops-alerts` + HITL Queue + email
**Clicks / actions:**
1. Click `New Run` again.
2. Select the same `Healing Demo Workflow (JSON Import)`.
3. Paste the same payload.
4. Execute.
5. Immediately switch to:
   - Slack `#ops-alerts` to show the HITL Required message with the “Review” action link.
   - HITL Queue tab to show the pending decision.
   - Your inbox to show the HITL email CTA.
6. Approve from Slack or from the HITL approval link.
**Voiceover:**  
“Finally, I force a scenario where healing can’t recover. The healer escalates to HITL: you’ll see the Slack approval link, the HITL queue entry, and an email. Then I approve, and execution resumes.”

### 2:20 - 2:30 — Autopsy tab + docs + close
**On screen:** Autopsy Reports tab + fast tab sweep + quick docs open
**Clicks / actions:**
1. Open the `Autopsy Reports` page and show the latest entry (and PDF download link if visible).
2. Quick sweep (fast clicks): `Healing Events` → `Integrations` → `Analytics` (just to prove the broader system is wired).
3. Open documentation: `http://localhost:5174/docs/`
4. Close with Swagger URL: `http://localhost:3000/docs`
**Voiceover:**  
“That’s FlowSentrix: confidence-gated execution, self-healing with rollback and replay, and HITL escalation when recovery fails.

In the real stress-test numbers: 2.5 seconds to heal on average, and only 8% of cases require a human decision. So low confidence doesn’t stop the pipeline—it triggers recovery.

For the full system details, here’s the docs, and for the API reference here’s Swagger. Thank you.”

