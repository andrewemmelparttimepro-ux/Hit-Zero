// SPOT — the deployed agent inside Hit Zero. Named for the person every
// cheer skill depends on: the spotter. Read-only over the gym the caller can
// already see — every query runs with the caller's own token, so program
// scoping and role visibility are RLS's job, not this file's.
import { runAgent, rest } from './_runtime.js';

const PERSONA = `## WHO YOU ARE
You are SPOT — the assistant built into Hit Zero, the operating system for the
cheer gym. You are named for the spotter: always watching, first to notice,
zero drama. You know the roster, skills, schedule, classes, and registrations.

## HOW YOU WORK
- Warm but brief — coaches and owners read you between practices.
- Ground every claim in tool data. Never invent athletes, dates, or numbers.
- Athlete wellbeing framing: progress is celebrated, gaps are "next steps",
  never failures.
- Respect privacy instincts: share only what the caller's role can see, and
  never volunteer contact details unless asked directly.
- You are read-only today: you observe and report; you do not change records.`;

const TOOLS = [
  {
    name: 'get_roster',
    description: 'Athletes in the program with their team. Optionally filter by team name.',
    parameters: {
      type: 'object',
      properties: { team: { type: 'string' }, limit: { type: 'number' } },
    },
    async execute(args, { token }) {
      let q = 'athletes?select=id,display_name,age,position,joined_at,teams(name)&deleted_at=is.null&order=display_name.asc';
      q += `&limit=${Math.min(Number(args.limit) || 40, 80)}`;
      const rows = await rest(token, q);
      const filtered = args.team
        ? (rows ?? []).filter(r => r.teams?.name?.toLowerCase().includes(String(args.team).toLowerCase()))
        : rows;
      return filtered;
    },
  },
  {
    name: 'get_skill_progress',
    description: 'Skill statuses for one athlete (by athlete id from get_roster), grouped by category.',
    parameters: {
      type: 'object',
      properties: { athlete_id: { type: 'string' } },
      required: ['athlete_id'],
    },
    async execute(args, { token }) {
      return rest(token, `athlete_skills?athlete_id=eq.${encodeURIComponent(args.athlete_id)}&select=status,note,updated_at,skills(name,category,level)&order=updated_at.desc&limit=60`);
    },
  },
  {
    name: 'get_schedule',
    description: 'Upcoming sessions/practices for the program, next 14 days by default.',
    parameters: { type: 'object', properties: { limit: { type: 'number' } } },
    async execute(args, { token }) {
      const now = new Date().toISOString();
      return rest(token, `sessions?scheduled_at=gte.${now}&select=scheduled_at,duration_min,type,location,is_competition,teams(name)&order=scheduled_at.asc&limit=${Math.min(Number(args.limit) || 15, 30)}`);
    },
  },
  {
    name: 'get_registrations',
    description: 'Registration pipeline: pending, accepted, and waitlisted signups. Staff visibility only.',
    parameters: {
      type: 'object',
      properties: { status: { type: 'string', description: 'pending | accepted | waitlist | rejected | withdrawn' } },
    },
    async execute(args, { token }) {
      let q = 'registrations?select=athlete_name,level_interest,status,created_at,decided_at&order=created_at.desc&limit=30';
      if (args.status) q += `&status=eq.${encodeURIComponent(args.status)}`;
      return rest(token, q);
    },
  },
  {
    name: 'get_classes',
    description: 'Class offerings with enrollment counts.',
    parameters: { type: 'object', properties: {} },
    async execute(_args, { token }) {
      const classes = await rest(token, 'program_classes?select=id,name,day_of_week,start_time,capacity&limit=25');
      const withCounts = await Promise.all((classes ?? []).map(async c => {
        const enrolled = await rest(token, `class_enrollments?class_id=eq.${c.id}&select=id`).catch(() => []);
        return { ...c, enrolled: enrolled?.length ?? 0 };
      }));
      return withCounts;
    },
  },
];

export default async function handler(req, res) {
  return runAgent({
    req, res,
    agentName: 'SPOT',
    persona: PERSONA,
    toolCatalog: TOOLS,
    callerTag: 'spot-hitzero',
  });
}
