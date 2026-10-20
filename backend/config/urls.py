from mimetypes import guess_type
from pathlib import Path

from django.contrib import admin
from django.http import FileResponse, Http404
from django.urls import include, path, re_path

from accounts import views as account_views
from blog import views as blog_views

FRONTEND_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_PAGES = {
    "index.html",
    "login.html",
    "signup.html",
    "student.html",
    "consultant.html",
    "manager.html",
    "magazine.html",
    "blog-editor.html",
    "blog-detail.html",
    "blog-review.html",
    "consultations.html",
    "consultation-management.html",
    "consultation-chat.html",
    "consultant-register.html",
}
FRONTEND_ASSET_DIRS = {"assets", "css", "js"}


def frontend_index(request):
    return frontend_file(request, "index.html")


def frontend_file(request, path):
    requested = Path(path)
    if not path or path.startswith(".") or ".." in requested.parts:
        raise Http404
    if path not in FRONTEND_PAGES and requested.parts[0] not in FRONTEND_ASSET_DIRS:
        raise Http404

    file_path = (FRONTEND_ROOT / requested).resolve()
    try:
        file_path.relative_to(FRONTEND_ROOT)
    except ValueError:
        raise Http404
    if not file_path.is_file():
        raise Http404

    content_type = guess_type(file_path.name)[0] or "application/octet-stream"
    return FileResponse(file_path.open("rb"), content_type=content_type)


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/consultations/", include("consultations.urls")),
    path("api/auth/csrf/", account_views.csrf_token, name="csrf-token"),
    path("api/auth/login/", account_views.login_user, name="login"),
    path("api/auth/me/", account_views.current_user, name="current-user"),
    path("api/auth/profile/gender/", account_views.update_student_gender, name="student-gender-update"),
    path("api/auth/profile/update/", account_views.update_student_profile, name="student-profile-update"),
    path("api/auth/logout/", account_views.logout_user, name="logout"),
    path("api/auth/password/change/", account_views.change_password, name="change-password"),
    path("api/manager/users/", account_views.manager_user_list, name="manager-user-list"),
    path("api/manager/users/<int:user_id>/password/", account_views.manager_set_user_password, name="manager-set-user-password"),
    path("api/auth/register/", account_views.start_registration, name="register"),
    path("api/auth/register/verify/", account_views.verify_registration, name="register-verify"),
    path("api/blog/posts/", blog_views.published_posts, name="blog-posts"),
    path("api/blog/posts/<int:post_id>/", blog_views.published_post_detail, name="blog-post-detail"),
    path("api/blog/posts/<int:post_id>/moderate/", blog_views.moderate_post, name="blog-post-moderate"),
    path("api/blog/posts/<int:post_id>/revise/", blog_views.revise_rejected_post, name="blog-post-revise"),
    path("api/blog/mine/", blog_views.my_posts, name="blog-my-posts"),
    path("api/blog/pending/", blog_views.pending_posts, name="blog-pending-posts"),
    path("api/blog/create/", blog_views.create_post, name="blog-create"),
    re_path(r"^media/(?P<path>.+)$", blog_views.serve_blog_media, name="blog-media"),
    path("", frontend_index, name="frontend-home"),
    re_path(r"^(?P<path>.+)$", frontend_file, name="frontend-file"),
]
