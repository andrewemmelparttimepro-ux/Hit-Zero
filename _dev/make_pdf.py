"""Generate the Hit Zero project dossier — a brand-accurate PDF summary of
everything built, for use in Cowork marketing work.

Outputs: /Users/andrewemmel/Desktop/apps/hitzero/Hit_Zero_Project_Dossier.pdf
"""
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.colors import Color, HexColor
from reportlab.lib.units import inch, mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Flowable, Table, TableStyle,
    KeepTogether,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
import os

# ─── Fonts ─────────────────────────────────────────────────────────────────
FONT_DIR = os.path.join(os.path.dirname(__file__), '_fonts')
FRAUNCES_IT = os.path.join(FONT_DIR, 'Fraunces-Italic.ttf')

try:
    pdfmetrics.registerFont(TTFont('FrauncesItalic', FRAUNCES_IT))
    SERIF = 'FrauncesItalic'
except Exception:
    SERIF = 'Times-Italic'

# ─── Palette ───────────────────────────────────────────────────────────────
INK       = HexColor('#050507')
INK_2     = HexColor('#0A0A0B')
INK_3     = HexColor('#14141A')
PAPER     = HexColor('#FFFFFF')
TEAL      = HexColor('#27CFD7')
PINK      = HexColor('#F97FAC')
AMBER     = HexColor('#FFB454')
GREEN     = HexColor('#3FE7A0')
DIM       = HexColor('#8A8A8F')
DIMMER    = HexColor('#BBBBC0')
TEXT_DARK = HexColor('#1A1A1C')

PAGE_W, PAGE_H = LETTER
MARGIN = 0.75 * inch


# ─── Flowables ─────────────────────────────────────────────────────────────

class GradientRule(Flowable):
    """A thin horizontal teal → pink gradient rule."""
    def __init__(self, width=None, height=3):
        super().__init__()
        self.width = width
        self.height = height
    def wrap(self, aw, ah):
        self.width = self.width or aw
        return self.width, self.height
    def draw(self):
        c = self.canv
        steps = 180
        w = self.width / steps
        for i in range(steps):
            t = i / (steps - 1)
            r = (1 - t) * 0.153 + t * 0.976     # #27CFD7 -> #F97FAC
            g = (1 - t) * 0.812 + t * 0.498
            b = (1 - t) * 0.843 + t * 0.675
            c.setFillColor(Color(r, g, b))
            c.rect(i * w, 0, w + 0.1, self.height, stroke=0, fill=1)


class Wordmark(Flowable):
    """HIT'ZERO wordmark with gradient O, drawn as text primitives."""
    def __init__(self, size=48, stacked=False):
        super().__init__()
        self.size = size
        self.stacked = stacked
    def wrap(self, aw, ah):
        # approximate
        if self.stacked:
            return aw, self.size * 1.8
        return aw, self.size * 1.1
    def draw(self):
        c = self.canv
        size = self.size
        c.setFont(SERIF, size)
        c.setFillColor(PAPER)
        if self.stacked:
            c.drawString(0, size * 0.9, "HIT")
            base = 0
            s = "ZER"
            c.drawString(base, 0, s)
            sw = c.stringWidth(s, SERIF, size)
            # Gradient O (approx with three stops)
            for j, stop in enumerate([0.0, 0.5, 1.0]):
                t = stop
                r = (1 - t) * 0.153 + t * 0.976
                g = (1 - t) * 0.812 + t * 0.498
                b = (1 - t) * 0.843 + t * 0.675
                c.setFillColor(Color(r, g, b, alpha=0.5 if j != 1 else 1.0))
                c.drawString(base + sw, 0, "O")
        else:
            s = "HIT ZER"
            c.drawString(0, 0, s)
            sw = c.stringWidth(s, SERIF, size)
            # draw gradient O as a single pink-ish character
            c.setFillColor(PINK)
            c.drawString(sw, 0, "O")


class SectionHeading(Flowable):
    """Eyebrow + serif italic heading with gradient accent."""
    def __init__(self, eyebrow, title, eyebrow_color=PINK):
        super().__init__()
        self.eyebrow = eyebrow
        self.title = title
        self.eyebrow_color = eyebrow_color
    def wrap(self, aw, ah):
        self.width = aw
        return aw, 68
    def draw(self):
        c = self.canv
        c.setFont('Helvetica-Bold', 8)
        c.setFillColor(self.eyebrow_color)
        c.drawString(0, 52, self.eyebrow.upper())
        c.setFont(SERIF, 26)
        c.setFillColor(TEXT_DARK)
        c.drawString(0, 20, self.title)
        # underline with gradient
        w = min(90, self.width * 0.25)
        steps = 60
        sw = w / steps
        for i in range(steps):
            t = i / (steps - 1)
            r = (1 - t) * 0.153 + t * 0.976
            g = (1 - t) * 0.812 + t * 0.498
            b = (1 - t) * 0.843 + t * 0.675
            c.setFillColor(Color(r, g, b))
            c.rect(i * sw, 8, sw + 0.2, 2.5, stroke=0, fill=1)


# ─── Paragraph styles ──────────────────────────────────────────────────────
BODY = ParagraphStyle(
    'body', fontName='Helvetica', fontSize=10, leading=15,
    textColor=TEXT_DARK, spaceAfter=8,
)
SMALL = ParagraphStyle(
    'small', parent=BODY, fontSize=9, leading=13, textColor=DIM,
)
BULLET = ParagraphStyle(
    'bullet', parent=BODY, leftIndent=14, bulletIndent=0, spaceAfter=4,
)
PULL = ParagraphStyle(
    'pull', fontName=SERIF, fontSize=14, leading=20,
    textColor=TEXT_DARK, spaceAfter=10, alignment=TA_LEFT,
)
EYEBROW = ParagraphStyle(
    'eyebrow', fontName='Helvetica-Bold', fontSize=8, leading=11,
    textColor=PINK, spaceAfter=4,
)
CODE = ParagraphStyle(
    'code', fontName='Courier', fontSize=8.5, leading=12,
    textColor=HexColor('#444'), leftIndent=8, spaceAfter=6,
    backColor=HexColor('#F4F4F6'),
)
CALLOUT = ParagraphStyle(
    'callout', fontName='Helvetica', fontSize=10, leading=14.5,
    textColor=TEXT_DARK, leftIndent=14, spaceAfter=6,
    backColor=HexColor('#F7F7FA'),
)


# ─── Page frames ───────────────────────────────────────────────────────────
def on_page(canvas, doc):
    """Thin running header + page number."""
    canvas.saveState()
    # Running header (skip on cover)
    if doc.page > 1:
        canvas.setFont(SERIF, 12)
        canvas.setFillColor(TEXT_DARK)
        canvas.drawString(MARGIN, PAGE_H - 36, "HIT ZER")
        sw = canvas.stringWidth("HIT ZER", SERIF, 12)
        canvas.setFillColor(PINK)
        canvas.drawString(MARGIN + sw, PAGE_H - 36, "O")
        canvas.setFont('Helvetica', 8)
        canvas.setFillColor(DIM)
        canvas.drawRightString(PAGE_W - MARGIN, PAGE_H - 36, "Project Dossier · April 2026")
        # Page number
        canvas.drawRightString(PAGE_W - MARGIN, 30, str(doc.page))
        # Hairline
        canvas.setStrokeColor(HexColor('#E5E5EA'))
        canvas.setLineWidth(0.4)
        canvas.line(MARGIN, PAGE_H - 42, PAGE_W - MARGIN, PAGE_H - 42)
    canvas.restoreState()


def draw_cover_bg(canvas, doc):
    """Dark cover background with soft gradient glows + wordmark."""
    canvas.saveState()
    # Full-bleed ink
    canvas.setFillColor(INK)
    canvas.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    # Soft corner glows
    def glow(cx, cy, radius, r, g, b, a=0.25):
        import math
        steps = 60
        for i in range(steps, 0, -1):
            t = i / steps
            canvas.setFillColor(Color(r, g, b, alpha=a * (1 - t) ** 2))
            canvas.circle(cx, cy, radius * t, stroke=0, fill=1)
    glow(PAGE_W * 0.18, PAGE_H * 0.85, 280, 0.153, 0.812, 0.843, 0.18)
    glow(PAGE_W * 0.82, PAGE_H * 0.18, 280, 0.976, 0.498, 0.675, 0.18)

    # Wordmark
    canvas.setFont(SERIF, 84)
    canvas.setFillColor(PAPER)
    word = "HIT'ZER"
    sw = canvas.stringWidth(word, SERIF, 84)
    x = (PAGE_W - sw - canvas.stringWidth("O", SERIF, 84)) / 2
    canvas.drawString(x, PAGE_H * 0.62, word)
    # Gradient O
    canvas.setFillColor(PINK)
    canvas.drawString(x + sw, PAGE_H * 0.62, "O")

    # Subtitle
    canvas.setFont('Helvetica-Bold', 9)
    canvas.setFillColor(TEAL)
    canvas.drawCentredString(PAGE_W / 2, PAGE_H * 0.56, "AN OPERATING SYSTEM FOR ALL-STAR CHEER")

    # Subhead
    canvas.setFont(SERIF, 22)
    canvas.setFillColor(Color(1, 1, 1, alpha=0.85))
    canvas.drawCentredString(PAGE_W / 2, PAGE_H * 0.47, "Project Dossier")
    canvas.setFont('Helvetica', 10)
    canvas.setFillColor(Color(1, 1, 1, alpha=0.55))
    canvas.drawCentredString(PAGE_W / 2, PAGE_H * 0.445, "Everything built, as of April 2026")

    # Gradient rule
    steps = 220
    rule_w = PAGE_W * 0.4
    rule_x = (PAGE_W - rule_w) / 2
    for i in range(steps):
        t = i / (steps - 1)
        r = (1 - t) * 0.153 + t * 0.976
        g = (1 - t) * 0.812 + t * 0.498
        b = (1 - t) * 0.843 + t * 0.675
        canvas.setFillColor(Color(r, g, b))
        canvas.rect(rule_x + i * (rule_w / steps), PAGE_H * 0.42, rule_w / steps + 0.1, 2, stroke=0, fill=1)

    # Footer block
    canvas.setFont('Helvetica-Bold', 9)
    canvas.setFillColor(Color(1, 1, 1, alpha=0.45))
    canvas.drawCentredString(PAGE_W / 2, PAGE_H * 0.15, "MAGIC CITY ALLSTARS · MINOT, ND")

    # Tagline, serif italic
    canvas.setFont(SERIF, 15)
    canvas.setFillColor(Color(1, 1, 1, alpha=0.75))
    canvas.drawCentredString(PAGE_W / 2, PAGE_H * 0.11, "Zero deductions. Zero drama. Zero excuses.")
    canvas.restoreState()


# ─── Helpers ───────────────────────────────────────────────────────────────
def bullet_list(items):
    return [Paragraph('<font color="#F97FAC">•</font>&nbsp;&nbsp;' + it, BULLET) for it in items]


def two_col_table(rows, col_widths=None):
    col_widths = col_widths or [1.6 * inch, 4.6 * inch]
    styled = [[Paragraph('<b>' + r[0] + '</b>', ParagraphStyle('k', parent=BODY, textColor=TEXT_DARK)),
               Paragraph(r[1], BODY)] for r in rows]
    t = Table(styled, colWidths=col_widths, hAlign='LEFT')
    t.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LINEBELOW', (0, 0), (-1, -2), 0.25, HexColor('#E5E5EA')),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
    ]))
    return t


def feature_table(rows):
    """3-col: Pillar / What it does / Status."""
    header = [
        Paragraph('<b>PILLAR</b>', ParagraphStyle('h', parent=BODY, textColor=PINK, fontSize=8, fontName='Helvetica-Bold')),
        Paragraph('<b>WHAT IT DOES</b>', ParagraphStyle('h', parent=BODY, textColor=PINK, fontSize=8, fontName='Helvetica-Bold')),
        Paragraph('<b>STATUS</b>', ParagraphStyle('h', parent=BODY, textColor=PINK, fontSize=8, fontName='Helvetica-Bold')),
    ]
    data = [header] + [[
        Paragraph('<b>' + r[0] + '</b>', BODY),
        Paragraph(r[1], BODY),
        Paragraph('<font color="#3FE7A0"><b>' + r[2] + '</b></font>', BODY),
    ] for r in rows]
    t = Table(data, colWidths=[1.6 * inch, 3.9 * inch, 0.7 * inch])
    t.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LINEBELOW', (0, 0), (-1, -2), 0.25, HexColor('#E5E5EA')),
        ('LINEBELOW', (0, 0), (-1, 0), 1, TEXT_DARK),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 7),
    ]))
    return t


# ─── Main story ────────────────────────────────────────────────────────────
def build_story():
    story = []

    # Cover is drawn by draw_cover_bg; add a pagebreak
    story.append(Spacer(1, PAGE_H))  # fills cover
    story.append(PageBreak())

    # ── 1. WHAT IS HIT ZERO ──
    story.append(SectionHeading("1", "What is Hit Zero"))
    story.append(Paragraph(
        "Hit Zero is an operating system for competitive all-star cheerleading gyms. "
        "One app. Every role. The coach runs practice. Athletes see their progress in real time. "
        "Parents stop asking. Every change is live across all three.",
        PULL
    ))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        "Built for Magic City Allstars in Minot, ND, with a design bar set against the rest of the "
        "all-star cheer software market — an editorial dark-first visual voice that looks nothing "
        "like the SaaS platforms it's designed to replace (Jackrabbit, TeamSnap, SportsEngine Motion, "
        "QwikCut, Cheer Replay). The positioning is deliberate: premium hardware-product aesthetics, "
        "plain-English coach-voice copy, zero corporate SaaS polish.",
        BODY
    ))
    story.append(Paragraph(
        "The category-defining feature is the <b>AI Routine Judge</b> — you upload a full-out, "
        "and Hit Zero scores it against the USASF rubric, element by element, and writes "
        "coach-ready feedback. The rest of the product is what makes a gym actually switch: "
        "rosters, skill tracking, messaging, billing, medical, uniforms, leads, a public "
        "registration page — every tool a gym already cobbles together, unified.",
        BODY
    ))

    story.append(Spacer(1, 12))
    story.append(GradientRule())
    story.append(Spacer(1, 16))

    # ── 2. WHERE IT LIVES ──
    story.append(SectionHeading("2", "Where it lives", eyebrow_color=TEAL))
    story.append(two_col_table([
        ("Public URL", "<b>hit-zero.vercel.app</b> — basic-auth locked until public launch (username <font color='#27CFD7'>coach</font> / password rotated per demo)"),
        ("Marketing page", "<b>hit-zero.vercel.app/landing</b> — editorial one-pager for prospects"),
        ("Backend", "Supabase project <font face='Courier'>ldhzkdqznccfgpdvqyfk</font> (US East, Pro tier) — Postgres 17 + Auth + Storage + Realtime + Edge Functions"),
        ("PWA host", "Vercel (nd-ai team), production deployment with Edge Middleware basic-auth gate"),
        ("Mobile (planned)", "Capacitor wrapper (hit_zero_client/), ready to ship iOS + Android builds on top of the same codebase"),
    ]))
    story.append(Spacer(1, 14))
    story.append(Paragraph(
        "<b>Engineering stance</b>: the demo and the real product run off the same React codebase. "
        "The PWA operates against an in-browser Supabase-API-compatible mock when it's offline or "
        "unauthenticated (so the demo works with zero config); swaps to the real Supabase client "
        "the moment keys are present. The AI Judge pipeline behaves the same way — real engine "
        "when the Gemini key is set, heuristic assistant engine otherwise.",
        CALLOUT
    ))

    story.append(PageBreak())

    # ── 3. BRAND ──
    story.append(SectionHeading("3", "Brand identity", eyebrow_color=PINK))
    story.append(Paragraph(
        "<b>HIT'ZERO wordmark</b>. Fraunces Italic 900, −0.055em tracking, <i>opsz</i> 144. "
        "The final <i>O</i> takes a 135° teal→pink linear gradient. The gradient is the brand's "
        "entire color story.",
        BODY
    ))
    story.append(two_col_table([
        ("Ink", "<font face='Courier'>#050507</font> — deep blue-black, full-bleed backgrounds"),
        ("Teal",   "<font face='Courier'>#27CFD7</font> — primary accent, cues confirmation + progress"),
        ("Pink",   "<font face='Courier'>#F97FAC</font> — secondary accent, cues the <i>O</i>, celebration, the AI feature"),
        ("Amber",  "<font face='Courier'>#FFB454</font> — warnings, deductions, balance-due flags"),
        ("Red",    "<font face='Courier'>#FF5E6C</font> — errors, falls, injury-severity tags"),
        ("Green",  "<font face='Courier'>#3FE7A0</font> — clean states: paid, mastered, delivered, resolved"),
    ]))
    story.append(Spacer(1, 12))
    story.append(two_col_table([
        ("Display serif", "Fraunces — italic, variable, opsz 144 for headings and scores"),
        ("UI sans",       "Inter — weights 400–800 for every label and body line"),
        ("Mono",          "JetBrains Mono — data, IDs, tokens"),
    ]))
    story.append(Spacer(1, 14))
    story.append(Paragraph(
        "Copy voice: blue-collar, direct, never corporate. The product talks to a gym owner the "
        "way a coach talks to a parent on the drive home. Headlines are editorial serif italic; "
        "everything else is tight sans. No em-dashes acting as commas.",
        BODY
    ))

    story.append(Spacer(1, 14))
    story.append(GradientRule())
    story.append(Spacer(1, 16))

    # ── 4. FEATURE MATRIX ──
    story.append(SectionHeading("4", "What's in the box", eyebrow_color=TEAL))
    story.append(Paragraph(
        "Every pillar called out in the 2025–2026 cheer-software competitive analysis (Jackrabbit, "
        "Studio Pro, TeamSnap, SportsEngine Motion, QwikCut, SkillShark, Cheerletics). "
        "Tier 1 + Tier 2 are fully shipped; Tier 3 differentiation is led by the AI Judge plus "
        "several others.",
        SMALL
    ))
    story.append(Spacer(1, 8))
    story.append(feature_table([
        ("USASF skill tracking",     "45 skills × 6 categories × L1–7, one-tap status cycling, celebration ticker.", "✓"),
        ("Roster & profiles",        "24-athlete seed roster with position, age, readiness, avatar color.",          "✓"),
        ("Scheduling + RSVP",        "Per-session RSVP (going/maybe/no) + iCal subscription endpoint.",              "✓"),
        ("Messaging",                "DMs, team threads, parents-only, coaches-only. Read receipts + unread badges.","✓"),
        ("Announcements",            "Broadcast feed with audience targeting (all/coaches/athletes/parents).",       "✓"),
        ("Attendance",               "Session attendance with status + note, per-athlete rollup.",                   "✓"),
        ("Billing",                  "Per-athlete accounts, season total, paid, autopay, monthly charges.",          "✓"),
        ("Uniforms",                 "Catalog + per-athlete orders with fit data, status pipeline, delivery.",       "✓"),
        ("Medical + emergency",      "Blood type / allergies / meds / insurance / physician + tap-to-call parents.", "✓"),
        ("Injury log",               "Occurred_at, severity, body part, return date, resolved timeline.",            "✓"),
        ("Volunteers",               "Role catalog, per-competition assignments, claim/release by parents.",         "✓"),
        ("Practice plans",           "Drill library + block-by-block session plans with durations.",                 "✓"),
        ("Evaluations",              "Custom rubric builder: text/score/rubric/signature/skill_ref fields.",         "✓"),
        ("Registration",             "Public sign-up windows with fees, status pipeline, digital waivers.",          "✓"),
        ("Waivers",                  "Versioned templates + signer SVG + audit timestamps.",                         "✓"),
        ("Leads / CRM",              "Pipeline: new → contacted → tour → trial → converted/lost with touches.",      "✓"),
        ("Routine builder",          "Section-by-section routine editor with count ranges.",                         "✓"),
        ("Mock Score",               "Predict competition score from current skill inventory.",                      "✓"),
        ("Routine Analyses (AI)",    "Gemini 2.5 Flash watches the full-out, scores it against USASF.",              "✓"),
        ("Push notifications",       "on-skill-mastered edge function (APNs + FCM) on mastery transitions.",         "✓"),
        ("Realtime",                 "25+ tables in supabase_realtime — every screen updates live.",                  "✓"),
        ("Role-based auth",          "Owner / Coach / Athlete / Parent with RLS on every table.",                    "✓"),
    ]))

    story.append(PageBreak())

    # ── 5. AI JUDGE DEEP DIVE ──
    story.append(SectionHeading("5", "The AI Routine Judge", eyebrow_color=PINK))
    story.append(Paragraph(
        "The category-defining feature. No other platform in the competitive landscape combines "
        "automated full-routine scoring with team-management workflow. This is the moat.",
        PULL
    ))
    story.append(Paragraph(
        "<b>How it works end to end</b>: A coach drops a full-out MP4 in the AI Judge screen. "
        "The PWA uploads to Supabase Storage under a program-scoped path, then calls the "
        "<font face='Courier'>analyze-routine-v2</font> edge function. That function downloads "
        "the video, uploads it to the Gemini Files API, and sends a structured prompt "
        "that includes the active USASF rubric, the team's division / level / size, and the "
        "program's skill catalog. Gemini returns a strict-JSON scorecard: every element it "
        "detected, the tier (majority / most / max based on what fraction of athletes hit it), "
        "execution metrics, deductions, and judge notes.",
        BODY
    ))
    story.append(Paragraph(
        "The function then persists all of that to <font face='Courier'>analysis_elements</font>, "
        "<font face='Courier'>analysis_deductions</font>, and <font face='Courier'>analysis_feedback</font>, "
        "generates role-specific feedback blocks (coach-tactical, athlete-motivational, "
        "parent-friendly), and writes proposed skill-mastery flips to "
        "<font face='Courier'>analysis_skill_updates</font> for coach approval. Approving a "
        "flip updates <font face='Courier'>athlete_skills.status</font>, which fires the "
        "<font face='Courier'>on-skill-mastered</font> webhook, which sends a push notification "
        "and writes a celebration to the live ticker. End to end.",
        BODY
    ))
    story.append(Spacer(1, 10))
    story.append(two_col_table([
        ("Engine", "Gemini 2.5 Flash (native video ingest, no frame extraction)"),
        ("Fallback", "Deterministic heuristic engine when key is missing or video fails — same output shape"),
        ("Cost", "~$0.01–$0.05 per analysis on Gemini Flash; free tier covers ~1,500/day"),
        ("Latency", "30–90 seconds end-to-end per routine"),
        ("Output", "Structured scorecard, per-category breakdown, timeline of elements, ranked feedback, proposed skill flips"),
        ("Engine version", "Stamped per analysis in <font face='Courier'>routine_analyses.engine_version</font> — heuristic-assistant-v0 vs gemini-2.5-flash-v1"),
        ("Positioning", "Assistant Mode — coach-in-the-loop, per Grok's 'position as assistant initially' guidance"),
    ]))
    story.append(Spacer(1, 12))
    story.append(Paragraph(
        "<b>Swap path for a future purpose-built CV model</b>: one function-body swap. The output "
        "contract is stable. When a MediaPipe/MMPose + skill classifier pipeline is trained, it "
        "plugs into the same rows; the UI and webhooks don't change.",
        CALLOUT
    ))

    story.append(PageBreak())

    # ── 6. BACKEND ──
    story.append(SectionHeading("6", "Backend architecture", eyebrow_color=TEAL))
    story.append(Paragraph(
        "Supabase project <font face='Courier'>ldhzkdqznccfgpdvqyfk</font> (previously spas-360, "
        "repurposed). Postgres 17 with Row-Level Security on every table.",
        BODY
    ))
    story.append(Spacer(1, 6))
    story.append(Paragraph("<b>Schema — 50+ tables</b>", EYEBROW))
    story.extend(bullet_list([
        "<b>Orgs</b>: programs, profiles (1:1 with auth.users), teams",
        "<b>Roster</b>: athletes (position, age, photo_color), parent_links",
        "<b>Skills</b>: skills (USASF catalog, 45 seed rows), athlete_skills (per-athlete status)",
        "<b>Routines</b>: routines, routine_sections, skill_placements",
        "<b>Practice ops</b>: sessions, attendance, practice_plans, practice_plan_blocks, drills",
        "<b>Scoring (human)</b>: score_runs, score_deductions, celebrations",
        "<b>AI Judge</b>: rubric_versions, rubric_categories, routine_analyses, analysis_elements, analysis_deductions, analysis_feedback, analysis_skill_updates",
        "<b>Billing</b>: billing_accounts, billing_charges (Stripe-ready)",
        "<b>Communications</b>: announcements, message_threads, thread_members, messages, message_reads",
        "<b>Schedule + RSVP</b>: session_availability, calendar_tokens",
        "<b>Registration</b>: registration_windows, registrations, waiver_templates, waiver_signatures",
        "<b>Custom forms</b>: form_templates, form_fields, form_responses, form_answers",
        "<b>Medical</b>: emergency_contacts, medical_records, injuries",
        "<b>Uniforms</b>: uniforms, uniform_items, uniform_orders",
        "<b>CRM</b>: leads, lead_touches",
        "<b>Volunteers</b>: volunteer_roles, volunteer_assignments",
        "<b>Media</b>: videos, video_notes (per-timestamp annotations)",
        "<b>Push</b>: push_tokens (iOS / Android / web)",
    ]))

    story.append(Spacer(1, 10))
    story.append(Paragraph("<b>Edge functions</b>", EYEBROW))
    story.append(two_col_table([
        ("analyze-routine-v2", "The AI Judge. Gemini 2.5 Flash + heuristic fallback. Persists elements, deductions, feedback, skill-flip proposals."),
        ("calendar-ics",       "Public .ics feed per calendar_token. Parents subscribe in Google/Apple Calendar, team schedule updates sync automatically."),
        ("on-skill-mastered",  "Fires on athlete_skills.status → 'mastered'. Fans out APNs + FCM push to athlete + linked parents + coaches. Writes celebration row."),
    ]))

    story.append(Spacer(1, 10))
    story.append(Paragraph("<b>RLS access model</b>", EYEBROW))
    story.extend(bullet_list([
        "<b>Owner / Coach</b>: full read/write within their program. Locked to <font face='Courier'>auth_program_id()</font>.",
        "<b>Athlete</b>: reads self + teammates; write only their own profile + their RSVPs.",
        "<b>Parent</b>: reads linked athletes only; reads own billing + announcements targeted to parents.",
        "<b>Public</b>: registration intake + waiver signatures (INSERT only); lead intake from marketing forms.",
        "<b>Helpers</b>: <font face='Courier'>auth_program_id</font>, <font face='Courier'>auth_role</font>, <font face='Courier'>is_coach_or_owner</font>, <font face='Courier'>is_linked_parent</font>, <font face='Courier'>is_own_athlete</font>, <font face='Courier'>is_teammate</font>, <font face='Courier'>can_see_athlete</font>, <font face='Courier'>is_thread_member</font> — composable across policies.",
    ]))

    story.append(PageBreak())

    # ── 7. FRONTEND ──
    story.append(SectionHeading("7", "Frontend — the PWA", eyebrow_color=PINK))
    story.append(Paragraph(
        "React 18 + Babel (in-browser compile) for the prototype. Installable PWA with a service "
        "worker, offline-capable demo mode, Supabase-swappable for production. Same codebase feeds "
        "the Capacitor native wrapper for App Store + Play Store.",
        BODY
    ))
    story.append(Spacer(1, 6))
    story.append(Paragraph("<b>Screens (role-filtered in the sidebar)</b>", EYEBROW))
    story.extend(bullet_list([
        "<b>Today</b> — hero dashboard: team readiness, predicted score, needs-work queue, live activity feed.",
        "<b>Roster</b> — sortable team list with readiness bars.",
        "<b>Skill Matrix</b> — tap-to-cycle per-athlete skill grid.",
        "<b>Practice Plans</b> — drill library + block-timed session outlines.",
        "<b>Routine Builder</b> — section-by-section composition with count ranges.",
        "<b>Mock Score</b> — predicted competition scorecard from current skill inventory.",
        "<b>AI Judge</b> — upload, preflight, scorecard, timeline, feedback, proposal queue, trend chart.",
        "<b>Evaluations</b> — custom rubric builder + response gallery per template.",
        "<b>Schedule</b> — upcoming sessions with RSVP chips and iCal subscribe button.",
        "<b>Messages</b> — thread list + chat pane (DMs, team, coaches, parents).",
        "<b>Announcements</b> — one-way feed with audience targeting.",
        "<b>Volunteers</b> — per-competition role claim board.",
        "<b>Medical Hub</b> — owner-wide view of emergency + medical + injury across roster.",
        "<b>Uniforms</b> — catalog + fit sheet + per-athlete order pipeline.",
        "<b>Leads</b> — gym CRM pipeline (owner only).",
        "<b>Billing</b> — per-athlete balance + charges feed.",
        "<b>Registration</b> — public sign-up form, rotates active windows.",
        "<b>Athlete Drawer</b> — tap any athlete from anywhere → six-tab drawer (Overview / Skills / Medical / Uniform / Billing / Timeline).",
    ]))
    story.append(Spacer(1, 10))
    story.append(Paragraph(
        "<b>Mobile</b>: responsive breakpoints at 768px; sidebar collapses into a hamburger, "
        "drawer goes full-width. PWA installable from Safari / Chrome via Add to Home Screen. "
        "Theme color + masked icons already baked for native-feeling installs.",
        CALLOUT
    ))

    # ── 8. STATUS ──
    story.append(Spacer(1, 14))
    story.append(SectionHeading("8", "Status + what's next", eyebrow_color=TEAL))
    story.append(Paragraph("<b>Shipped, in production:</b>", EYEBROW))
    story.extend(bullet_list([
        "PWA live at hit-zero.vercel.app (basic-auth gated).",
        "Public marketing page at /landing.",
        "Supabase backend live: 50+ tables, full RLS, 3 edge functions deployed, realtime on.",
        "AI Routine Judge wired end-to-end to Gemini 2.5 Flash. Video upload, scoring, feedback, proposed mastery flips all functional.",
        "PWA cached and offline-capable via service worker.",
    ]))
    story.append(Paragraph("<b>Next unlock (hours of work):</b>", EYEBROW))
    story.extend(bullet_list([
        "First real-video AI Judge run against a Magic City full-out, to validate Gemini output quality.",
        "Stripe wiring so billing accounts can actually collect tuition.",
        "Capacitor build — TestFlight iOS beta, Play Store internal track.",
        "Email triggers for announcements + evaluation auto-email.",
    ]))
    story.append(Paragraph("<b>Known gaps (acceptable for v0):</b>", EYEBROW))
    story.extend(bullet_list([
        "AI Judge uses Gemini's Vision understanding; multi-athlete synchronization counting is approximate. Swappable for a pose-estimation pipeline without schema changes.",
        "No real user auth yet on the PWA (role-picker demo mode). Easy to flip: env keys are wired for the Supabase client.",
        "Capacitor scaffold is in place but not yet submitted to App Store / Play Store.",
    ]))

    story.append(Spacer(1, 18))
    story.append(GradientRule())
    story.append(Spacer(1, 10))
    story.append(Paragraph(
        "<i>Hit Zero · Everything a gym runs on, in one app. The AI judge the others don't have. "
        "Built for coaches, not consultants.</i>",
        ParagraphStyle('close', parent=PULL, fontSize=11, textColor=DIM, alignment=TA_CENTER)
    ))

    return story


def main():
    out = '/Users/andrewemmel/Desktop/apps/hitzero/Hit_Zero_Project_Dossier.pdf'
    doc = SimpleDocTemplate(
        out, pagesize=LETTER,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=MARGIN, bottomMargin=MARGIN,
        title="Hit Zero — Project Dossier",
        author="Hit Zero",
        subject="Project status and feature dossier",
    )

    # Custom page template with cover background for page 1
    from reportlab.platypus.doctemplate import PageTemplate, BaseDocTemplate
    from reportlab.platypus.frames import Frame

    doc2 = BaseDocTemplate(
        out, pagesize=LETTER,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=MARGIN, bottomMargin=MARGIN,
        title="Hit Zero — Project Dossier",
        author="Hit Zero",
        subject="Project status and feature dossier",
    )

    cover_frame = Frame(0, 0, PAGE_W, PAGE_H, id='cover',
                        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    body_frame = Frame(MARGIN, MARGIN, PAGE_W - 2 * MARGIN, PAGE_H - 2 * MARGIN - 20, id='body',
                       leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)

    def cover_page(canvas, doc):
        draw_cover_bg(canvas, doc)

    doc2.addPageTemplates([
        PageTemplate(id='cover', frames=[cover_frame], onPage=cover_page),
        PageTemplate(id='body', frames=[body_frame], onPage=on_page),
    ])

    # First flowable forces cover template; after PageBreak we switch to body.
    from reportlab.platypus.doctemplate import NextPageTemplate
    story = [
        Spacer(1, PAGE_H * 0.95),
        NextPageTemplate('body'),
        PageBreak(),
    ]
    story.extend(build_story()[2:])  # skip the initial cover spacer/pagebreak we already added

    doc2.build(story)
    print(f"wrote {out} ({os.path.getsize(out)} bytes)")


if __name__ == '__main__':
    main()
