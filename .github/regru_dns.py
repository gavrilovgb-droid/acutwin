import time
from playwright.sync_api import sync_playwright

PASS   = "Cbf-9ii-Mcn-ywB"
DOMAIN = "acutwin.ru"
VPS_IP = "194.67.92.166"

# Пробуем все варианты логина по очереди
LOGINS = ["gavrilovgb@gmail.com", "ggbksi@gmail.com", "ggbksi"]

def ss(page, name):
    page.screenshot(path=f"/tmp/{name}.png")
    print(f"  [screenshot] {name}.png")

def try_login(page, user, password):
    print(f"  Trying login: {user}")
    page.goto("https://www.reg.ru/", wait_until="domcontentloaded")
    time.sleep(3)

    # Закрываем куки
    try:
        page.locator("text=Хорошо").click(timeout=3000)
        time.sleep(1)
    except: pass

    # Кликаем Войти
    for sel in ["a:has-text('Войти')", "button:has-text('Войти')"]:
        try:
            if page.locator(sel).first.is_visible(timeout=3000):
                page.locator(sel).first.click()
                break
        except: pass

    # Ждём модал
    try:
        page.wait_for_selector('input[placeholder*="логин"]', timeout=8000)
    except: pass

    # Заполняем
    for sel in ['input[placeholder*="логин"]', 'input[placeholder*="email"]',
                'input[placeholder*="почта"]', 'input[autocomplete="username"]']:
        try:
            if page.locator(sel).first.is_visible(timeout=2000):
                page.locator(sel).first.fill(user)
                break
        except: pass

    try:
        page.locator('input[type="password"]').first.fill(password)
    except: pass

    page.keyboard.press("Enter")
    try:
        page.wait_for_url("**/lk/**", timeout=10000)
        return True
    except:
        time.sleep(3)
        return "lk" in page.url

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
    ctx = browser.new_context(
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121",
        locale="ru-RU", viewport={"width": 1280, "height": 800}
    )
    page = ctx.new_page()
    page.set_default_timeout(30000)

    # ── 1-3. Перебираем логины ────────────────────────────────
    print("=== Steps 1-3: Try all logins ===")
    logged_in = False
    for i, user in enumerate(LOGINS):
        result = try_login(page, user, PASS)
        ss(page, f"s{i+1}_login_{user.split('@')[0]}")
        print(f"  {user} → {'OK' if result else 'FAIL'} | URL: {page.url}")
        if result:
            logged_in = True
            print(f"  SUCCESS with: {user}")
            break
        time.sleep(2)

    ss(page, "s4_final_login_state")
    print("Logged in:", logged_in, "| URL:", page.url)

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
