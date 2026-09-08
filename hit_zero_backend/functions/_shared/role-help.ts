export const HELP_VERSION = 'getting-started-2026-09';
export const HELP_ROLES = ['owner','coach','parent','athlete'];
export function roleHelp(role:string) {
  const common={id:`${HELP_VERSION}:${role}`,role,eyebrow:`Hit Zero guide · ${role==='owner'?'Gym owner':role}`,footer:'Find this guide anytime with ? in the header. Hover over a control or focus it with Tab for a short explanation. On a phone, tap an info button. If an update is ready, save your work, then tap “Update when ready.”'};
  const guides:any={
    owner:{title:'Your gym, with clearer next steps.',intro:'The changes that matter to your daily work, and where to find them.',primary_label:'Open family setup',primary_route:'admin?family_setup=1',items:[
      {title:'Keep every child connected',body:'Program → Family setup now keeps every parent visible after the first child is linked. Search a parent or child, check existing links, then choose the correct athlete to add. Linking does not sign forms.',route:'admin?family_setup=1',action:'Manage family access'},
      {title:'Review registrations before contacting families',body:'Registration separates submitted registrations from unfinished checkout attempts. Check the payment review and existing receipt before sending a follow-up.',route:'registration',action:'Review registrations'},
      {title:'Read each child’s forms separately',body:'A completed packet belongs to one child. Historical forms flagged for review still need family confirmation. Never use a sibling’s form to fill a gap.',route:'medical',action:'Review medical records'},
      {title:'Use recorded money and progress',body:'Billing keeps posted child balances separate from Square’s overall totals. Saved skill assessments survive family relinking. Missing scores or attendance are not proof of poor performance.',route:'billing',action:'Open billing'},
      {title:'Check the right view',body:'View as changes the layout for review; it does not sign you in as a particular parent or athlete. Ask that person to confirm their own device when investigating an access problem.'},
    ]},
    coach:{title:'Less setup. More time coaching.',intro:'Start with your team, record what you observed, and keep families informed.',primary_label:'Open Skill Matrix',primary_route:'skills',items:[
      {title:'Start with Today and your roster',body:'Review upcoming practice, select the right team, and open an athlete from Roster. Empty attendance or assessment history means no record yet.',route:'today',action:'Open Today'},
      {title:'Save the assessment you observed',body:'Use Skill Matrix to record status and coach notes. Athlete practice reports stay separate from your assessment; family relinking does not erase saved progress.',route:'skills',action:'Open Skill Matrix'},
      {title:'Score a complete run',body:'In Mock Score, select the team and enter every required category. A missing category stays blank. A retry uses the same saved run rather than creating another score.',route:'score',action:'Open Mock Score'},
      {title:'Check safety and communicate',body:'Review the selected athlete’s medical information before practice. Treat flagged historical records as needing family confirmation. Schedule and Messages keep the team aligned.',route:'medical',action:'Open Medical'},
      {title:'Read AI results with context',body:'AI Judge needs the actual video. Missing, failed or heuristic-only analysis is unscored. Review the evidence before using feedback in coaching.',route:'ai_judge',action:'Open AI Judge'},
    ]},
    parent:{title:'Every child, in one family view.',intro:'A quick guide to your children, forms, schedule and payments. Gym tools appear after your account is approved.',primary_label:'Open family overview',primary_route:'parent',items:[
      {title:'Choose the child first',body:'Overview now shows all linked children near the top. Tap a name to open that child’s profile. If someone is missing, ask gym staff to review your family links; you do not need a separate parent account for each child.',route:'parent',action:'Open Overview'},
      {title:'Complete forms for each child',body:'Open Forms, choose the child, review the saved details and confirm that child before submitting. A sibling’s finished packet does not complete another child’s forms.',route:'family_forms',action:'Open Forms'},
      {title:'Check your actual schedule',body:'Schedule shows your recorded class enrollments and linked team sessions. If something you registered for is missing, ask staff to check the enrollment and child link.',route:'schedule',action:'Open Schedule'},
      {title:'Review before paying again',body:'Billing separates registration receipts from the posted season balance. If payment confirmation is pending or records could not load, refresh or ask staff before paying twice.',route:'billing',action:'Open Billing'},
      {title:'Follow progress and ask questions',body:'Skills shows the coach’s assessment and notes. Parents review that assessment; athletes record their own practice separately. Use Messages to ask the team about next steps.',route:'skilltree',action:'Review Skills'},
    ]},
    athlete:{title:'Know what to practice next.',intro:'Your progress, practice reports and team updates are together here.',primary_label:'Open Skill Tree',primary_route:'skilltree',items:[
      {title:'Start with your reel',body:'My Reel shows saved progress and team activity. “Not assessed yet” means your coach has not recorded an assessment; it is not a failing score.',route:'reel',action:'Open My Reel'},
      {title:'Keep practice reports honest',body:'In Skill Tree, choose a skill and record how practice is going. Your practice report stays separate from the coach’s assessment. Working is still progress.',route:'skilltree',action:'Open Skill Tree'},
      {title:'Stay in the team loop',body:'Check Schedule for team sessions, Team Feed for updates, and Messages for conversations. If something is missing, ask your coach.',route:'schedule',action:'Open Schedule'},
      {title:'Understand feedback',body:'AI Judge needs video evidence. An unscored or failed result is not a zero. Ask your coach to help interpret any feedback.',route:'ai_judge',action:'Open AI Judge'},
      {title:'Let a guardian handle forms',body:'A parent or guardian confirms medical details and signs required waivers. Ask them or gym staff if your profile needs family setup.'},
    ]},
  };
  return HELP_ROLES.includes(role)?{...common,...guides[role]}:null;
}
