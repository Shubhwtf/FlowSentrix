export type NavigationPage = {
  slug: string;
  title: string;
  description: string;
};

export type NavigationSection = {
  title: string;
  pages: NavigationPage[];
};

export const navigation: NavigationSection[] = [
  {
    title: 'Getting Started',
    pages: [
      { slug: 'introduction', title: 'Introduction', description: 'Why FlowSentrix exists and what it changes.' },
      { slug: 'quickstart', title: 'Quickstart', description: 'Run the stack locally and trigger your first demo run.' }
    ]
  },
  {
    title: 'Core Concepts',
    pages: [
      { slug: 'architecture', title: 'Architecture', description: 'System layers, storage, event bus, and state machine.' },
      { slug: 'agents', title: 'Agents', description: 'Orchestrator, Monitor, Healer, and Worker agent roles.' },
      { slug: 'healing', title: 'Healing', description: 'Confidence gating, rollback, replay, HITL, autopsy reports.' },
      { slug: 'workflows', title: 'Workflows', description: 'Workflow JSON schema and the visual builder.' },
      { slug: 'events', title: 'Events', description: 'Redis event bus, event shapes, and delivery guarantees.' },
      { slug: 'state-machine', title: 'State Machine', description: 'Run lifecycle states and transitions across all agents.' }
    ]
  },
  {
    title: 'Deep Dives',
    pages: [
      { slug: 'rollback', title: 'Rollback', description: 'Snapshots, reversible transaction log, and replay executor.' },
      { slug: 'hitl', title: 'HITL', description: 'Human-in-the-loop approvals, Slack and email flows.' },
      { slug: 'autopsy', title: 'Autopsy Reports', description: 'Autopsy schema, generation prompts, and delivery.' }
    ]
  },
  {
    title: 'Reference',
    pages: [
      { slug: 'tools', title: 'Tools', description: 'Tool registry, adapters, and tool definitions.' },
      { slug: 'api', title: 'API', description: 'Routes, auth, streaming, and payload shapes.' },
      { slug: 'integrations', title: 'Integrations', description: 'Slack, GitHub, Resend, and mock adapters.' }
    ]
  },
  {
    title: 'Operations',
    pages: [
      { slug: 'demo', title: 'Demo Guide', description: 'End-to-end demo script for live walkthroughs.' },
      { slug: 'publishing', title: 'Publishing', description: 'How to share FlowSentrix with the wider community.' }
    ]
  }
];

export const flattenPages = (sections: NavigationSection[]) =>
  sections.flatMap((section) => section.pages.map((page) => ({ ...page, section: section.title })));

