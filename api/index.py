from http.server import BaseHTTPRequestHandler
import json
import os
import urllib.request
import urllib.error
import re
import threading

ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
MODEL = "claude-haiku-4-5"

SABOTEUR_SYSTEM = """You are AGENT 01 — THE SABOTEUR. Forensic Auditor. Internal threat detection specialist.
Perform a deep forensic audit of the venture's internal architecture. Tone: clinical, adversarial, precise. UK English.
Return a JSON object with exactly these keys:
- executive_risk_summary_finding: one punchy sentence (max 18 words) — the single most dangerous internal flaw
- executive_risk_summary: 150-180 word dense prose executive overview, lead with the most dangerous structural flaw
- operational_risks_finding: one punchy sentence (max 18 words) — the critical operational defect
- operational_risks: 120-150 word TIM WOODS waste scan, name waste categories inline, end with the one defect most likely to cause failure
- financial_risks_finding: one punchy sentence (max 18 words) — the most dangerous financial exposure
- financial_risks: 120-150 word analysis of cash flow, burn rate, margin fragility, scaling traps, CAC/LTV dangers
- failure_probability_indicators_finding: one punchy sentence (max 18 words) — the top failure signal
- failure_probability_indicators: 100-130 word brutally honest failure signals, reference founder execution, timing, structural defects"""

PREDATOR_SYSTEM = """You are AGENT 02 — THE PREDATOR. Market Rival. External offensive strategist.
Think like the smartest hostile incumbent who wants this venture dead. Tone: predatory, cold, strategic. UK English.
Return a JSON object with exactly these keys:
- market_saturation_analysis_finding: one punchy sentence (max 18 words) — the most dangerous market threat
- market_saturation_analysis: 120-150 word analysis of market crowding and positioning weakness
- regional_geographic_challenges_finding: one punchy sentence (max 18 words) — the key regional threat
- regional_geographic_challenges: 120-150 word location-specific threats, regulatory barriers, geographic limitations
- competitor_attack_analysis_finding: one punchy sentence (max 18 words) — the most exploitable moat breach
- competitor_attack_analysis: 120-150 word adversarial SWOT-A, name attacker archetype, attack vector, timeline, question founder is not asking
- customer_psychology_risks_finding: one punchy sentence (max 18 words) — the primary customer resistance factor
- customer_psychology_risks: 100-130 word analysis of why the target customer will resist, hesitate, or abandon"""

ORCHESTRATOR_SYSTEM = """You are AGENT 03 — THE SYNTHESIS ORCHESTRATOR. Strategic Partner. Executive governance layer.
Synthesise all findings into an investor-grade verdict. Tone: authoritative, direct, strategic. UK English.
Return a JSON object with exactly these keys:
- resilience_score: integer 0-100 (most ventures score 30-60, reserve 80+ for genuinely defensible architectures)
- investor_perspective_finding: one punchy sentence (max 18 words) — the single biggest reason a VC would pass
- investor_perspective: 140-170 word investor analysis, cover scalability, defensibility, timing, margin, VC pass reason
- strategic_recommendations_finding: one punchy sentence (max 18 words) — the single highest-leverage pivot move
- strategic_recommendations: 140-170 word Pivot Roadmap, highest-leverage move addressing both internal defect and external attack, end with Pivot: or Hold: or Kill: directive
- pivot_directive: exactly one sentence starting with Pivot: or Hold: or Kill: — the final verdict"""


def call_claude(system, user_content, results, key):
    try:
        payload = {
            "model": MODEL,
            "max_tokens": 1800,
            "system": system,
            "messages": [
                {"role": "user", "content": user_content},
                {"role": "assistant", "content": "{"}
            ]
        }
        req = urllib.request.Request(
            ANTHROPIC_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "x-api-key": ANTHROPIC_KEY,
                "anthropic-version": "2023-06-01",
            },
        )
        with urllib.request.urlopen(req, timeout=28) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        results[key] = "{" + data["content"][0]["text"]
    except Exception as e:
        results[key] = f"ERROR: {str(e)}"


def parse_json(raw):
    text = raw.strip()
    text = re.sub(r'^```(?:json)?\s*', '', text, flags=re.MULTILINE)
    text = re.sub(r'\s*```$', '', text, flags=re.MULTILINE)
    text = text.strip()
    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end != -1:
        text = text[start:end+1]
    return json.loads(text)


def derive_severity(score, section):
    high_sections = ['executive_risk_summary', 'competitor_attack_analysis', 'market_saturation_analysis', 'failure_probability_indicators']
    low_sections = ['customer_psychology_risks', 'regional_geographic_challenges']
    if section in high_sections:
        adj = 8
    elif section in low_sections:
        adj = -8
    else:
        adj = 0
    adjusted = score + adj
    if adjusted >= 65:
        return 'HIGH'
    elif adjusted >= 40:
        return 'MEDIUM'
    else:
        return 'LOW'


class handler(BaseHTTPRequestHandler):

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_POST(self):
        try:
            if not ANTHROPIC_KEY:
                self._respond(500, {"error": "ANTHROPIC_API_KEY not set."})
                return

            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length).decode("utf-8"))
            hypothesis = body.get("hypothesis", "").strip()

            if len(hypothesis) < 20:
                self._respond(400, {"error": "Hypothesis too thin. Minimum 20 characters."})
                return

            prompt = f"VENTURE HYPOTHESIS:\n\n{hypothesis}"
            results = {}

            threads = [
                threading.Thread(target=call_claude, args=(SABOTEUR_SYSTEM, prompt, results, "r1")),
                threading.Thread(target=call_claude, args=(PREDATOR_SYSTEM, prompt, results, "r2")),
                threading.Thread(target=call_claude, args=(ORCHESTRATOR_SYSTEM, prompt, results, "r3")),
            ]
            for t in threads: t.start()
            for t in threads: t.join(timeout=30)

            try:
                agent1 = parse_json(results.get("r1", "{}"))
            except Exception:
                agent1 = {"executive_risk_summary": results.get("r1", "Parse error.")[:600], "executive_risk_summary_finding": "Analysis unavailable.", "operational_risks": "", "operational_risks_finding": "", "financial_risks": "", "financial_risks_finding": "", "failure_probability_indicators": "", "failure_probability_indicators_finding": ""}

            try:
                agent2 = parse_json(results.get("r2", "{}"))
            except Exception:
                agent2 = {"market_saturation_analysis": results.get("r2", "Parse error.")[:600], "market_saturation_analysis_finding": "Analysis unavailable.", "regional_geographic_challenges": "", "regional_geographic_challenges_finding": "", "competitor_attack_analysis": "", "competitor_attack_analysis_finding": "", "customer_psychology_risks": "", "customer_psychology_risks_finding": ""}

            try:
                agent3 = parse_json(results.get("r3", "{}"))
            except Exception:
                agent3 = {"resilience_score": 50, "investor_perspective": results.get("r3", "Parse error.")[:600], "investor_perspective_finding": "Analysis unavailable.", "strategic_recommendations": "", "strategic_recommendations_finding": "", "pivot_directive": ""}

            score = max(0, min(100, int(agent3.get("resilience_score", 50))))

            # Derive severity for all sections
            sections = [
                "executive_risk_summary", "operational_risks", "financial_risks", "failure_probability_indicators",
                "market_saturation_analysis", "regional_geographic_challenges", "competitor_attack_analysis", "customer_psychology_risks",
                "investor_perspective", "strategic_recommendations"
            ]
            severity = {s: derive_severity(score, s) for s in sections}

            audit_id = f"AVA-{__import__('datetime').datetime.now().strftime('%Y%m%d')}-{score:04d}"

            self._respond(200, {
                "score": score,
                "audit_id": audit_id,
                "severity": severity,
                "agent1": agent1,
                "agent2": agent2,
                "agent3": agent3
            })

        except urllib.error.HTTPError as e:
            err = e.read().decode("utf-8") if e.fp else str(e)
            self._respond(500, {"error": f"Anthropic API error: {err}"})
        except Exception as e:
            self._respond(500, {"error": f"Server error: {str(e)}"})

    def _respond(self, status, payload):
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(payload).encode("utf-8"))
