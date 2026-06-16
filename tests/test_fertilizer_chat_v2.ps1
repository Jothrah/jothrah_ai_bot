$api = "https://jothrah-ai-bot.vercel.app/api/chat"

$tests = @(
  "هل اقدر اخلط نترات كالسيوم مع زنك مخلب؟",
  "ينفع اخلط بورون مع كالسيوم؟",
  "ابغي اخلط حمض فوسفوريك مع كالسيوم",
  "سماد 15 15 15 كيف استخدمه؟",
  "عندي سماد محبب 20-20-20 لمساحة 90 متر بيت محمي",
  "كم pH المسموح للهيوميك السائل؟",
  "كم البي اتش المسموح في سماد NPK؟",
  "وش بيانات الملصق المطلوبة للسماد؟"
)

foreach ($t in $tests) {
  Write-Host "\n=============================="
  Write-Host "TEST: $t"
  $body = @{ message = $t } | ConvertTo-Json
  Invoke-RestMethod -Uri $api -Method POST -ContentType "application/json; charset=utf-8" -Body $body | ConvertTo-Json -Depth 10
}

