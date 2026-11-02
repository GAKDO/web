# Data Model (화면 상태): WE2

- **CaptureGrant**(메모리): accessToken, rentalId, checkpointId, expiresAt(ms). 교환 응답에서 만든다.
- **FaceSlot**: face(CaptureFace), required(boolean), guide(문장), aspect(윤곽 가로:세로), shot(Shot | null), check(QualityResult | null).
- **Shot**: blob(JPEG), sha256(hex 64), takenAt(ISO), width, height, previewUrl(object URL, 화면용).
- **QualityResult**: ok, reason("BLUR" | "GLARE" | null), blurScore, glareRatio.
- **SubmitState**: phase("idle" | "creating" | "uploading" | "completing" | "done" | "error"), setId, uploads(UploadTarget[]), done(boolean[]), idempotencyKey, error(문장), missingFaces.
- 상태 흐름: idle → creating → uploading → completing → done. 실패하면 error에서 "다시 시도"로 uploading(실패분만) 또는 creating(만료·해시 불일치)으로.
