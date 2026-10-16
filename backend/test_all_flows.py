import requests
import json
import time
import sys

BASE_URL = "http://127.0.0.1"
HEADERS = {"Host": "paye.academy"}

def run_tests():
    passed = 0
    failed = 0

    def assert_true(condition, msg):
        nonlocal passed, failed
        if condition:
            passed += 1
            print(f"  [PASS] {msg}")
        else:
            failed += 1
            print(f"  [FAIL] {msg}")

    print("==================================================")
    print("      PAYE ACADEMY COMPREHENSIVE FLOW TESTS       ")
    print("==================================================")

    # ----------------------------------------------------
    # FLOW 1: Student Flow (danesh / 1234)
    # ----------------------------------------------------
    print("\n--- 1. Testing Student Flow (danesh / 1234) ---")
    s_client = requests.Session()
    s_client.headers.update(HEADERS)

    # CSRF pre-login
    r = s_client.get(f"{BASE_URL}/api/auth/csrf/?_t={time.time()}")
    assert_true(r.status_code == 200, f"Get CSRF token: {r.status_code}")
    csrf_token = r.json().get("csrfToken")

    # Login
    r = s_client.post(
        f"{BASE_URL}/api/auth/login/",
        json={"phone": "danesh", "password": "1234"},
        headers={"X-CSRFToken": csrf_token}
    )
    assert_true(r.status_code == 200, f"Student login: {r.status_code}")
    role = r.json().get("role")
    assert_true(role == "student", f"Student role is student: {role}")

    # Fetch post-login fresh CSRF token
    r = s_client.get(f"{BASE_URL}/api/auth/csrf/?_t={time.time()}")
    s_csrf = r.json().get("csrfToken")
    assert_true(bool(s_csrf), "Post-login fresh CSRF token obtained")

    # Auth Me
    r = s_client.get(f"{BASE_URL}/api/auth/me/?_t={time.time()}")
    assert_true(r.status_code == 200 and r.json().get("role") == "student", "Student auth/me returns student")
    assert_true(r.json().get("phone") == "danesh", f"Student phone is danesh: {r.json().get('phone')}")

    # Study Sessions (Weekly Plan)
    r = s_client.get(f"{BASE_URL}/api/consultations/study-sessions/")
    assert_true(r.status_code == 200, f"Get study sessions: {r.status_code}")
    sessions = r.json().get("results", [])
    assert_true(len(sessions) >= 5, f"Study sessions count: {len(sessions)}")
    print(f"       Subjects in schedule: {[s.get('subject') for s in sessions[:3]]}")

    # Study Timers Today
    r = s_client.get(f"{BASE_URL}/api/consultations/study-timers/today/")
    assert_true(r.status_code == 200, f"Get study timers today: {r.status_code}")
    timers = r.json().get("results", [])
    assert_true(len(timers) >= 1, f"Study timers today count: {len(timers)}")

    # Study Reports History
    r = s_client.get(f"{BASE_URL}/api/consultations/study-reports/")
    assert_true(r.status_code == 200, f"Get study reports history: {r.status_code}")
    reports = r.json().get("results", [])
    assert_true(len(reports) >= 5, f"Study reports count: {len(reports)}")

    # Study Feedbacks
    r = s_client.get(f"{BASE_URL}/api/consultations/study-feedbacks/")
    assert_true(r.status_code == 200, f"Get study feedbacks: {r.status_code}")
    feedbacks = r.json().get("results", [])
    assert_true(len(feedbacks) >= 1, f"Study feedbacks count: {len(feedbacks)}")

    # Consultation Request & Assigned Consultant
    r = s_client.get(f"{BASE_URL}/api/consultations/requests/")
    assert_true(r.status_code == 200, f"Get consultation requests: {r.status_code}")
    reqs = r.json().get("results", [])
    assert_true(len(reqs) >= 1, f"Active consultation request found: {len(reqs)}")
    active_req = reqs[0] if reqs else {}
    req_id = active_req.get("id")
    assert_true(active_req.get("status") == "approved", f"Request status is approved: {active_req.get('status')}")
    assert_true("محمد امینی" in active_req.get("assigned_consultant_name", ""), f"Assigned consultant: {active_req.get('assigned_consultant_name')}")

    # Consultation Chat Messages
    r = s_client.get(f"{BASE_URL}/api/consultations/requests/{req_id}/messages/")
    assert_true(r.status_code == 200, f"Get consultation chat messages: {r.status_code}")
    chat_msgs = r.json().get("results", [])
    assert_true(len(chat_msgs) >= 2, f"Existing chat messages count: {len(chat_msgs)}")

    # Send new message from Student (using JSON)
    r = s_client.post(
        f"{BASE_URL}/api/consultations/requests/{req_id}/messages/",
        json={"body": "سلام استاد، تست مبحث گوارش امروز حل شد و مشکلی نبود."},
        headers={"X-CSRFToken": s_csrf}
    )
    assert_true(r.status_code == 201, f"Student sends chat message: {r.status_code}")

    # ----------------------------------------------------
    # FLOW 2: Consultant Flow (moshaver / 1234)
    # ----------------------------------------------------
    print("\n--- 2. Testing Consultant Flow (moshaver / 1234) ---")
    c_client = requests.Session()
    c_client.headers.update(HEADERS)

    # CSRF pre-login
    r = c_client.get(f"{BASE_URL}/api/auth/csrf/?_t={time.time()}")
    c_pre_csrf = r.json().get("csrfToken")

    # Login
    r = c_client.post(
        f"{BASE_URL}/api/auth/login/",
        json={"phone": "moshaver", "password": "1234"},
        headers={"X-CSRFToken": c_pre_csrf}
    )
    assert_true(r.status_code == 200, f"Consultant login: {r.status_code}")
    c_role = r.json().get("role")
    assert_true(c_role == "consultant", f"Consultant role is consultant: {c_role}")

    # Post-login fresh CSRF
    r = c_client.get(f"{BASE_URL}/api/auth/csrf/?_t={time.time()}")
    c_csrf = r.json().get("csrfToken")
    assert_true(bool(c_csrf), "Consultant post-login fresh CSRF token obtained")

    # Auth Me
    r = c_client.get(f"{BASE_URL}/api/auth/me/?_t={time.time()}")
    assert_true(r.status_code == 200 and r.json().get("role") == "consultant", "Consultant auth/me returns consultant")

    # Profile & Pricing
    r = c_client.get(f"{BASE_URL}/api/consultations/profile/")
    assert_true(r.status_code == 200, f"Get consultant profile: {r.status_code}")
    p_data = r.json()
    assert_true(p_data.get("experience_years") == 10, f"Experience years: {p_data.get('experience_years')}")
    assert_true(p_data.get("prices", {}).get("vip") == 2500000, f"VIP price: {p_data.get('prices', {}).get('vip')}")

    # Assigned Students List
    r = c_client.get(f"{BASE_URL}/api/consultations/requests/")
    assert_true(r.status_code == 200, f"Consultant gets assigned students: {r.status_code}")
    c_reqs = r.json().get("results", [])
    assert_true(any(cr.get("student_phone") == "danesh" for cr in c_reqs), "Student danesh is in consultant assignments")

    # Consultant replies to Student in Chat (JSON)
    r = c_client.post(
        f"{BASE_URL}/api/consultations/requests/{req_id}/messages/",
        json={"body": "بسیار عالی دانیال جان، نکات کلیدی گوارش رو در دفتر یادداشت وارد کن."},
        headers={"X-CSRFToken": c_csrf}
    )
    assert_true(r.status_code == 201, f"Consultant replies in chat: {r.status_code}")

    # Staff Conversation (Consultant <-> Manager)
    r = c_client.get(f"{BASE_URL}/api/consultations/staff-conversations/")
    assert_true(r.status_code == 200, f"Consultant gets staff conversations: {r.status_code}")
    staff_data = r.json()
    staff_conv_id = staff_data.get("conversation", {}).get("id")
    assert_true(bool(staff_conv_id), f"Staff conversation id: {staff_conv_id}")

    # Staff Conversation Messages
    r = c_client.get(f"{BASE_URL}/api/consultations/staff-conversations/{staff_conv_id}/messages/")
    assert_true(r.status_code == 200, f"Get staff conversation messages: {r.status_code}")
    staff_msgs = r.json().get("results", [])
    assert_true(len(staff_msgs) >= 2, f"Existing staff messages count: {len(staff_msgs)}")

    # Consultant sends message to Manager (JSON)
    r = c_client.post(
        f"{BASE_URL}/api/consultations/staff-conversations/{staff_conv_id}/messages/",
        json={"body": "جناب مدیر، برنامه هفتگی دانش‌آموز جدید تکمیل شد."},
        headers={"X-CSRFToken": c_csrf}
    )
    assert_true(r.status_code == 201, f"Consultant sends message to Manager: {r.status_code}")

    # Consultant's Blog posts
    r = c_client.get(f"{BASE_URL}/api/blog/mine/")
    assert_true(r.status_code == 200, f"Consultant gets my blog posts: {r.status_code}")
    my_posts = r.json().get("results", [])
    assert_true(len(my_posts) >= 2, f"Consultant blog posts count: {len(my_posts)}")

    # ----------------------------------------------------
    # FLOW 3: Manager Flow (aliAhmadloo / 1234)
    # ----------------------------------------------------
    print("\n--- 3. Testing Manager Flow (aliAhmadloo / 1234) ---")
    m_client = requests.Session()
    m_client.headers.update(HEADERS)

    # CSRF pre-login
    r = m_client.get(f"{BASE_URL}/api/auth/csrf/?_t={time.time()}")
    m_pre_csrf = r.json().get("csrfToken")

    # Login
    r = m_client.post(
        f"{BASE_URL}/api/auth/login/",
        json={"phone": "aliAhmadloo", "password": "1234"},
        headers={"X-CSRFToken": m_pre_csrf}
    )
    assert_true(r.status_code == 200, f"Manager login: {r.status_code}")
    m_role = r.json().get("role")
    assert_true(m_role in ["manager", "admin"], f"Manager role: {m_role}")

    # Post-login fresh CSRF
    r = m_client.get(f"{BASE_URL}/api/auth/csrf/?_t={time.time()}")
    m_csrf = r.json().get("csrfToken")
    assert_true(bool(m_csrf), "Manager post-login fresh CSRF token obtained")

    # Auth Me
    r = m_client.get(f"{BASE_URL}/api/auth/me/?_t={time.time()}")
    assert_true(r.status_code == 200 and r.json().get("role") in ["manager", "admin"], "Manager auth/me verified")

    # Manager User Management: Students
    r = m_client.get(f"{BASE_URL}/api/manager/users/?role=student")
    assert_true(r.status_code == 200, f"Manager list students: {r.status_code}")
    students_list = r.json().get("results", [])
    assert_true(any(u.get("phone") == "danesh" for u in students_list), "Student danesh listed in manager panel")

    # Manager User Management: Consultants
    r = m_client.get(f"{BASE_URL}/api/manager/users/?role=consultant")
    assert_true(r.status_code == 200, f"Manager list consultants: {r.status_code}")
    consultants_list = r.json().get("results", [])
    assert_true(any(u.get("phone") == "moshaver" for u in consultants_list), "Consultant moshaver listed in manager panel")

    # Manager Consultation Overview & Pricing
    r = m_client.get(f"{BASE_URL}/api/consultations/manage/")
    assert_true(r.status_code == 200, f"Manager consultation overview: {r.status_code}")
    m_overview = r.json()
    assert_true(len(m_overview.get("consultants", [])) >= 2, f"Consultants count in overview: {len(m_overview.get('consultants', []))}")
    assert_true(len(m_overview.get("pending_requests", [])) >= 1, f"Pending requests count in overview: {len(m_overview.get('pending_requests', []))}")

    # Manager Consultant Applications
    r = m_client.get(f"{BASE_URL}/api/consultations/manager/applications/")
    assert_true(r.status_code == 200, f"Manager consultant applications: {r.status_code}")
    apps = r.json().get("results", [])
    assert_true(len(apps) >= 1, f"Consultant applications count: {len(apps)}")
    pending_app = next((a for a in apps if a.get("status") == "pending"), None)
    assert_true(bool(pending_app), f"Found pending application: {pending_app.get('full_name') if pending_app else 'None'}")

    # Manager Staff Conversations list
    r = m_client.get(f"{BASE_URL}/api/consultations/staff-conversations/")
    assert_true(r.status_code == 200, f"Manager gets staff conversations list: {r.status_code}")
    m_staff_rooms = r.json().get("results", [])
    assert_true(len(m_staff_rooms) >= 1, f"Staff rooms for manager: {len(m_staff_rooms)}")

    # Manager replies to Consultant in Staff Chat (JSON)
    target_room = m_staff_rooms[0] if m_staff_rooms else {}
    room_id = target_room.get("id")
    r = m_client.post(
        f"{BASE_URL}/api/consultations/staff-conversations/{room_id}/messages/",
        json={"body": "درود آقای امینی، برنامه بررسی و تایید شد."},
        headers={"X-CSRFToken": m_csrf}
    )
    assert_true(r.status_code == 201, f"Manager replies to Consultant: {r.status_code}")

    # Manager Blog Moderation (Pending Posts)
    r = m_client.get(f"{BASE_URL}/api/blog/pending/")
    assert_true(r.status_code == 200, f"Manager gets pending blog posts: {r.status_code}")
    pending_posts = r.json().get("results", [])
    assert_true(len(pending_posts) >= 1, f"Pending blog posts count: {len(pending_posts)}")

    # Approve Pending Post
    if pending_posts:
        target_post = pending_posts[0]
        r = m_client.post(
            f"{BASE_URL}/api/blog/posts/{target_post['id']}/moderate/",
            json={"action": "approve"},
            headers={"X-CSRFToken": m_csrf}
        )
        assert_true(r.status_code == 200, f"Manager approved blog post #{target_post['id']}: {r.status_code}")
        assert_true(r.json().get("status") == "published", "Post status changed to published")

    # ----------------------------------------------------
    # FLOW 4: Public Magazine & Blog Image Serving
    # ----------------------------------------------------
    print("\n--- 4. Testing Public Magazine & Blog Flow ---")
    pub_client = requests.Session()
    pub_client.headers.update(HEADERS)

    # Get published posts
    r = pub_client.get(f"{BASE_URL}/api/blog/posts/")
    assert_true(r.status_code == 200, f"Get published blog posts: {r.status_code}")
    all_posts = r.json().get("results", [])
    assert_true(len(all_posts) >= 3, f"Published posts count: {len(all_posts)}")

    # Check post detail with sections and images
    first_post = all_posts[0]
    r = pub_client.get(f"{BASE_URL}/api/blog/posts/{first_post['id']}/")
    assert_true(r.status_code == 200, f"Get blog post detail #{first_post['id']}: {r.status_code}")
    p_detail = r.json()
    assert_true(len(p_detail.get("sections", [])) >= 2, f"Post has {len(p_detail.get('sections', []))} sections")
    assert_true(len(p_detail.get("images", [])) >= 1, f"Post has {len(p_detail.get('images', []))} image(s)")

    # Verify each image URL returns 200 from Nginx
    for post in all_posts:
        for img_obj in post.get("images", []):
            img_url = img_obj.get("url")
            r_img = pub_client.get(f"{BASE_URL}{img_url}")
            assert_true(r_img.status_code == 200, f"Image {img_url} loaded: HTTP {r_img.status_code} ({len(r_img.content)} bytes)")
            assert_true(r_img.headers.get("Content-Type", "").startswith("image/"), f"Image has image content-type: {r_img.headers.get('Content-Type')}")

    # ----------------------------------------------------
    # FLOW 5: Frontend HTML Pages
    # ----------------------------------------------------
    print("\n--- 5. Testing Frontend HTML Pages via Nginx ---")
    pages = [
        "/",
        "/index.html",
        "/login.html",
        "/signup.html",
        "/student.html",
        "/consultant.html",
        "/manager.html",
        "/magazine.html",
        "/blog-detail.html",
        "/consultations.html",
        "/consultant-register.html",
    ]
    for page in pages:
        r = pub_client.get(f"{BASE_URL}{page}")
        assert_true(r.status_code == 200, f"Page {page}: HTTP {r.status_code} ({len(r.content)} bytes)")

    print("\n==================================================")
    print(f"TEST SUMMARY: {passed} PASSED, {failed} FAILED")
    print("==================================================")
    return failed == 0

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
