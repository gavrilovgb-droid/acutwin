import time
from playwright.sync_api import sync_playwright

USER   = "ggbksi"
PASS   = "Elena196672!@"
DOMAIN = "acutwin.ru"
VPS_IP = "194.67.92.166"

def ss(page, name):
    page.screenshot(path=f"/tmp/{name}.png")
    print(f"  [screenshot] {name}.png")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
    ctx = browser.new_context(
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121",
        locale="ru-RU", viewport={"width": 1280, "height": 800}
    )
    page = ctx.new_page()
    page.set_default_timeout(30000)

    # ── 1. Главная ────────────────────────────────────────────
    print("=== Step 1: Load reg.ru ===")
    page.goto("https://www.reg.ru/", wait_until="domcontentloaded")
    time.sleep(3)
    ss(page, "s1_main")
    print("URL:", page.url)

    # Закрываем куки-баннер
    try:
        page.locator("text=Хорошо").click(timeout=3000)
        time.sleep(1)
    except:
        pass

    # ── 2. Кликаем Войти ─────────────────────────────────────
    print("=== Step 2: Click login ===")
    clicked = False
    for sel in [
        "a:has-text('Войти')",
        "button:has-text('Войти')",
        "[data-testid='login']",
        "a[href*='login']",
        "a[href*='account']",
    ]:
        try:
            loc = page.locator(sel).first
            if loc.is_visible(timeout=3000):
                loc.click()
                clicked = True
                print(f"  clicked: {sel}")
                break
        except:
            pass

    if not clicked:
        print("  fallback: click by coordinates")
        page.mouse.click(1113, 108)

    page.wait_for_load_state("domcontentloaded")
    time.sleep(3)
    ss(page, "s2_after_click")
    print("URL:", page.url)

    # ── 3. Форма логина ───────────────────────────────────────
    print("=== Step 3: Fill login form ===")
    ss(page, "s3_form")

    for sel in [
        'input[name="login"]',
        'input[type="text"]',
        'input[type="email"]',
        'input[autocomplete="username"]',
        'input[placeholder]',
    ]:
        try:
            loc = page.locator(sel).first
            if loc.is_visible(timeout=2000):
                loc.fill(USER)
                print(f"  login: {sel}")
                break
        except:
            pass

    try:
        page.locator('input[type="password"]').first.fill(PASS)
        print("  password: filled")
    except Exception as e:
        print("  password error:", e)

    ss(page, "s4_filled")

    for sel in [
        'button[type="submit"]',
        "button:has-text('Войти')",
        "button:has-text('Вход')",
    ]:
        try:
            loc = page.locator(sel).first
            if loc.is_visible(timeout=2000):
                loc.click()
                print(f"  submit: {sel}")
                break
        except:
            pass

    page.wait_for_load_state("networkidle")
    time.sleep(4)
    ss(page, "s5_loggedin")
    print("URL after login:", page.url)

    # ── 4. DNS управление ─────────────────────────────────────
    print("=== Step 4: DNS pages ===")
    for dns_url in [
        f"https://www.reg.ru/user/domain/{DOMAIN}/dns/",
        f"https://cp.reg.ru/domains/{DOMAIN}/dns",
        f"https://www.reg.ru/domain/new/service_list/?zone_name={DOMAIN}",
    ]:
        try:
            page.goto(dns_url, wait_until="networkidle", timeout=15000)
            time.sleep(2)
            tag = dns_url.rstrip("/").split("/")[-1]
            ss(page, f"s6_dns_{tag}")
            print(f"  {dns_url}")
            print(f"  -> {page.url} | {page.title()[:60]}")
        except Exception as e:
            print(f"  Error: {e}")

    print("=== Done ===")
    browser.close()
