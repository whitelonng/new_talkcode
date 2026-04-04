/**
 * Built-in Skills Definitions
 *
 * This file contains the definitions of built-in system skills that are
 * automatically deployed when TalkCody initializes.
 *
 * System skills are embedded in the application code and deployed to
 * ~/.talkcody/skills/ directory on startup.
 */

/**
 * TalkCody Knowledge Base System Skill
 *
 * Provides comprehensive information about TalkCody features, usage,
 * capabilities, and workflow.
 */
export const TALKCODY_KNOWLEDGE_BASE_SKILL = {
  name: 'talkcody-knowledge-base',
  directoryName: 'talkcody-knowledge-base',
  skillMdContent: `---
name: TalkCody Knowledge Base
description: Comprehensive information about TalkCody features, usage, capabilities, and best practices
version: 1.0.0
system: true
---

# TalkCody Knowledge Base

## About TalkCody

TalkCody is a desktop AI coding agent for macOS, Linux, and Windows that integrates advanced AI models with your development workflow. 
It provides intelligent code generation, analysis, and conversation capabilities through a modern, user-friendly interface.


## Keyboard Shortcuts

| Function | Mac | Description |
|------|-----|------|
| Global File Search | \`Cmd + O\` | Search project files |
| Global Content Search | \`Cmd + G\` | Search file contents |
| Search Within File | \`Cmd + F\` | Current file search |
| Save File | \`Cmd + S\` | Save current file |
| New Window | \`Cmd + Shift + N\` | Open new window |
| Model Settings | \`Cmd + Shift + M\` | Open model settings |
| Open Terminal | \`Cmd + J\` | Open terminal |

## Support and Resources

### Getting Help
- Visit the [TalkCody Documentation](https://www.talkcody.com/docs)

### Github Repository
- Explore the source code and contribute: [TalkCody GitHub](https://github.com/talkcody/talkcody)

### Report Issues
- Report bugs or request features: [TalkCody Issues](https://github.com/talkcody/talkcody/issues)

`,

  metadata: {
    skillId: '550e8400-e29b-41d4-a716-446655440000', // Fixed UUID for system skill
    source: 'system',
    isBuiltIn: true,
    version: '1.0.0',
  },
};

/**
 * Registry of all built-in skills
 * Add new system skills here
 */
export const BUILTIN_SKILLS = [TALKCODY_KNOWLEDGE_BASE_SKILL];
