import time
from playwright.sync_api import sync_playwright

USER   = "gavrilovgb@gmail.com"
PASS   = "Cbf-9ii-Mcn-ywB"
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

    # ── 3. Ждём модального окна и заполняем ──────────────────
    print("=== Step 3: Wait for modal & fill ===")
    # Модал содержит input с placeholder "Электронная почта или логин"
    try:
        page.wait_for_selector('input[placeholder*="логин"]', timeout=10000)
        print("  modal appeared")
    except:
        print("  modal wait timeout — trying anyway")
    ss(page, "s3_form")

    # Заполняем логин в модале по placeholder
    for sel in [
        'input[placeholder*="логин"]',
        'input[placeholder*="email"]',
        'input[placeholder*="почта"]',
        'input[autocomplete="username"]',
    ]:
        try:
            loc = page.locator(sel).first
            if loc.is_visible(timeout=3000):
                loc.fill(USER)
                print(f"  login: {sel}")
                break
        except:
            pass

    # Заполняем пароль
    try:
        page.locator('input[type="password"]').first.fill(PASS)
        print("  password: filled")
    except Exception as e:
        print("  password error:", e)

    ss(page, "s4_filled")

    # Нажимаем Enter
    page.keyboard.press("Enter")
    print("  submitted via Enter")

    # Ждём редиректа в ЛК
    try:
        page.wait_for_url("**/lk/**", timeout=20000)
        print("  redirected to LK")
    except:
        page.wait_for_load_state("networkidle")
    time.sleep(4)
    ss(page, "s5_loggedin")
    print("URL after login:", page.url)

    # ── 4. Переходим в управление DNS домена ─────────────────
    print("=== Step 4: Navigate to DNS ===")
    logged_in = "lk" in page.url or "reg.ru" in page.url

    if not logged_in:
        print("  ERROR: not logged in, check screenshots")
        browser.close()
        exit(1)

    # Пробуем найти DNS-страницу
    dns_found = False
    for dns_url in [
        f"https://www.reg.ru/lk/domains/{DOMAIN}/dns/",
        f"https://www.reg.ru/domain/new/service_list/?zone_name={DOMAIN}",
    ]:
        try:
            page.goto(dns_url, wait_until="domcontentloaded", timeout=15000)
            time.sleep(3)
            tag = dns_url.rstrip("/").split("/")[-1] or "dns"
            ss(page, f"s6_{tag}")
            print(f"  URL: {page.url} | {page.title()[:60]}")
            if "dns" in page.url.lower() or "DNS" in page.content():
                dns_found = True
                break
        except Exception as e:
            print(f"  Error: {e}")

    if not dns_found:
        print("  DNS page not found via direct URL, trying LK navigation...")
        page.goto("https://www.reg.ru/lk/domains/", wait_until="domcontentloaded")
        time.sleep(3)
        ss(page, "s7_lk_domains")
        print(f"  LK domains: {page.url} | {page.title()[:60]}")
        # Ищем ссылку на домен
        try:
            page.get_by_text(DOMAIN).first.click()
            time.sleep(2)
            ss(page, "s8_domain_page")
            print(f"  Domain page: {page.url}")
        except Exception as e:
            print(f"  Domain link error: {e}")

    print("=== Done - check screenshots ===")
    browser.close()
