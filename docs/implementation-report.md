# NEFRU Implementation Report

تاريخ التحقق: 2026-09-19. التنفيذ حصل في الـ workspace الحالي مع الحفاظ على التعديلات الموجودة مسبقًا. التقرير ده بيفصل اللي اتنفّذ واتجرّب عن اختبارات الخدمات الخارجية اللي لسه محتاجة إعدادات فعلية.

## 1. Architecture changes

- فصل Trip lifecycle عن moderation، مع explicit actions وصلاحيات على السيرفر.
- TripRevision منفصل وTrip._id ثابت؛ محتوى النسخة المنشورة يفضل موجود لحد الموافقة على revision.
- Occurrence دائم، Attendance داخل Booking، PrivateExperienceSurvey منفصل، وOperationalCase للتحقيقات والنزاعات.
- AuditLog وpersistent outbox بيتكتبوا مع التغيير داخل transaction؛ worker منفصل للتنبيهات والوظائف الزمنية.
- Public DTOs مشتركة تمنع تسريب بيانات الهوية والملاحظات الخاصة، بما فيها Saved Trips والـ public guides.

تفاصيل التصميم والـ state transitions والقيود موجودة في [marketplace-implementation.md](marketplace-implementation.md).

## 2. Database/model changes

الموديلات الجديدة: AuditLog، TripRevision، Occurrence، PrivateExperienceSurvey، OperationalCase، DomainJob، PaymentAttempt.

اتضافت حقول مستقلة لحالة الحساب، الهوية والرخصة، moderation، attendance، snapshots، commission، refund entitlement، availability وsettlement. Unique indexes بتحمي occurrence identity وopen revisions وreview/survey booking وjob/event keys.

Booking يحتفظ بالسعر والسياسة وقت الحجز وبمقعد واحد لكل سائح. حذف Seat عن طريق TTL اتلغى من الـ schema؛ الـ worker بيحرر الحجوزات المنتهية داخل transaction. الـ runtime بيرفض الـ legacy TTL لحد تشغيل الـ migration المخصصة. مفيش تعديل اتنفّذ على قاعدة بيانات التطبيق أو خدمة MongoDB المحلية.

## 3. Backend changes

- Guide ما يقدرش يوافق لنفسه، يرجّع hard rejection للمراجعة، أو يسترجع Admin-hidden Trip.
- تعديل Live Trip يفتح revision؛ تعديل schedule عند وجود حجوزات مستقبلية عليه قيود تحافظ على العقود السابقة.
- الحجز بيفحص الحساب والمرشد والرحلة والموعد داخل transaction؛ write fences بتحمي من سباق الإيقاف/إغلاق الحساب والحجز.
- الدفع فضل معتمد على Paymob server verification/inquiry. اتضافت حماية للـ duplicate/late callbacks وسجل PaymentAttempt؛ الدفع المتأخر بعد انتهاء المقعد بيروح refund review.
- Pause/hide/archive ما بيمسحوش الحجوزات. إلغاء الحساب بقى lifecycle request يحافظ على التاريخ.
- بدء/إنهاء الموعد والحضور عليهم ownership/time/state checks. عدم بدء الرحلة يفتح investigation؛ مفيش عقوبة آلية للمرشد.
- Verified reviews محتاجة paid booking + completed occurrence + checked-in attendance. Private survey منفصل؛ review السلبية مسموحة طالما مطابقة للسياسة.
- Ratings من published verified evidence؛ demo/legacy reviews ما بتتحولش تلقائيًا لـ Verified. Featured منفصل عن Top Rated.
- قوالب البريد مشتركة، الوظائف persistent، وnotification delivery لها deduplication. SMTP نفسه at-least-once.
- Runtime readiness endpoint وفحص indexes قبل قبول الطلبات، ومراجعة ENV دون إضافة credentials.

## 4. Frontend changes

اتضافت صفحة Operations للأدوار المختلفة لإدارة moderation/revisions/occurrences/attendance/cases. شاشات تعديل الرحلات بتقرأ revision الخاصة بدل تغيير النسخة المنشورة. اتحدّثت verification، reviews، earnings وaccount closure.

Available Today بقى مبني على مواعيد وسعة فعلية. اتشالت fallback trips والـ ratings الوهمية من واجهات العرض اللي اتراجعت، واتضاف Portfolio Demo banner. Public reviews ما بتعرضش Verified badge إلا لو القيمة true. اتصلحت أخطاء lint الموجودة بدون تعطيل قواعده، واتجهز SPA routing على Vercel دون نشر.

## 5. Migration scripts

- `backend/src/scripts/migrateMarketplace.js`: dry-run افتراضي وapply صريح، مع exact Atlas host/database guard لقاعدة `nefru_portfolio_demo` فقط.
- Mapping محافظ للحالات القديمة، snapshots للبيانات المعروفة فقط، occurrence identities، وتعطيل الـ seat TTL المعروف. الحالات الملتبسة بتحتاج مراجعة بدل اختراع دليل verification.
- `seed.demo.js`: deterministic IDs وupserts؛ حسابات demo و10 رحلات و10 reviews غير verified، بدون بيانات دفع أو هوية حقيقية.
- لا seed ولا migration اتشغّلوا على Atlas أو قاعدة محلية. خطوات backup/recovery والـ mapping موثّقة في دليل التنفيذ؛ الرجوع للكود القديم وحده مش rollback آمن بعد كتابة بيانات جديدة.

## 6. Files changed

أهم الملفات الجديدة:

- `backend/src/domain/policies.js`
- `backend/src/services/marketplace.service.js`, `reservation.service.js`, `reviewLifecycle.service.js`, `catalog.service.js`, `quality.service.js`, `domainWorker.service.js`, `mail.service.js`
- `backend/src/controllers/marketplace.controller.js`, `backend/src/routes/marketplace.routes.js`
- الموديلات السبعة المذكورة فوق داخل `backend/src/models/`
- `backend/src/scripts/migrateMarketplace.js`, `domain.worker.js`, `checkSyntax.js`
- `backend/src/tests/domain.test.js`, `marketplace.integration.test.js`
- `frontend/src/pages/Marketplace/Operations.jsx` وCSS المرتبط بها
- `frontend/vercel.json`, `.github/workflows/quality.yml`، وأدلة التنفيذ والنشر

أهم المجموعات المعدلة: Trip/Booking/Seat/Review/User/Guide models؛ legacy controllers وauthorization؛ payment finalization؛ auth/profile/media؛ config/startup؛ صفحات Guide/Admin/Tourist وrouting؛ ENV examples وpackage scripts/lockfiles.

[working-tree-files.txt](working-tree-files.txt) فيه قائمة Git working tree كاملة وقت التسليم. القائمة بتشمل التعديلات السابقة المحفوظة؛ مش معناها إن كل التغييرات بدأت في الاستكمال ده. مفيش commit أو push.

## 7. Tests executed

| الفحص | النتيجة |
|---|---|
| `npm run check` — backend | 107 JavaScript files نجحوا |
| `npm test` — backend | 16 passed، 0 failed، 0 skipped |
| `npm run lint` — frontend | نجح بدون errors أو warnings |
| `npm run build` — frontend | نجح؛ large-chunk warning موجود |
| `git diff --check` | نجح |

Integration tests شغّلت MongoDB 8.2.3 منفصل مؤقتًا، بـ dbPath وport مختلفين عن Windows Service. اتجربت transactions/rollback، concurrent seats، حماية revision/history، duplicate/late payment confirmation، attendance/review eligibility، survey privacy، verification، outbox deduplication، account closure وstale authenticated booking request.

HTTP smoke tests شملت health/readiness، trips، login/profile، 401 بدون login، و403 لمحاولة guide approve. دي مش browser E2E ولا إثبات نجاح اتصال Paymob أو SMTP فعلي. CI اتجهز لكن لم يُشغَّل على remote runner.

## 8. Remaining risks

- `.env.demo` غير موجود؛ Atlas وCloudinary وSMTP وPaymob Sandbox acceptance لم تُنفذ. يلزم اختبار الشبكة/credentials/webhooks/cookies فعليًا قبل النشر.
- Conditional tourist identity experiences بتتقفل أمام الحجز لحد توفير workflow التحقق الخاص بالسائح؛ demo trips لا تتطلبه.
- مستندات المرشدين محتاجة private persistent storage على الـ host. ممنوع اعتبار ephemeral filesystem تخزينًا دائمًا.
- لا automated refunds أو payouts أو destructive anonymization؛ دي قيود مقصودة حسب قرارات المنتج.
- مراجعة browser E2E، visitor abuse controls، monitoring وretention policy تفضل مطلوبة قبل استخدام حي واسع.
- Frontend bundle كبير؛ تحسين code splitting والأداء باقي. Email retries ممكن تكرر التسليم في failure window بعد إرسال SMTP وقبل تأكيد job.

## 9. Deployment readiness status

الكود والـ local checks جاهزين للانتقال لاختبارات التكامل الخارجية للـ portfolio؛ مش بنعلن deployment acceptance ناجح. دليل التشغيل: [portfolio-deployment.md](portfolio-deployment.md).

لم يتم إنشاء Atlas cluster أو نشر backend/frontend أو تغيير MongoDB Windows Service أو تشغيل migration على بيانات فعلية. قاعدة التطبيق المحلية لم تُستخدم في اختبارات التنفيذ.
