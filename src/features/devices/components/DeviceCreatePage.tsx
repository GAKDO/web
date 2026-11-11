import { PageHeader } from "../../../shared/ui/PageHeader";
import { FormActions, FormCard } from "../../../shared/ui/FormCard";
import { buttonVariants } from "@/components/ui/button";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { DeviceOs } from "../../../shared/api/types";
import { ApiError } from "../../../shared/api/problem";
import { messageFor } from "../../../shared/api/errorMessages";
import { DEVICE_OS_LABEL } from "../../../shared/codes/labels";
import { Button } from "../../../shared/ui/Button";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner";
import { Field, SelectField } from "../../../shared/ui/Field";
import { useCreateDevice, useDeviceModels } from "../api/devices";
import { matchModel, type LabelReading } from "../lib/labelParse";
import { LabelScanner } from "./LabelScanner";

/** 등록된 기종으로 새 기기를 등록한다(FR-013) */
export function DeviceCreatePage() {
  const navigate = useNavigate();
  const models = useDeviceModels();
  const create = useCreateDevice();
  const [serial, setSerial] = useState("");
  const [modelCode, setModelCode] = useState("");
  const [os, setOs] = useState<DeviceOs>("MACOS");
  const [color, setColor] = useState("");
  const [assetNo, setAssetNo] = useState("");
  const [error, setError] = useState<string | null>(null);

  // 기종 목록보다 OCR이 먼저 끝나면 기종 맞추기를 목록이 온 뒤로 미룬다
  const [pendingReading, setPendingReading] = useState<LabelReading | null>(null);

  /** 라벨에서 읽은 값으로 빈 칸을 미리 채운다. 못 읽은 값은 건드리지 않고, 관리자가 등록 전에 고칠 수 있다 */
  function fillFromLabel(reading: LabelReading) {
    if (reading.serial) setSerial(reading.serial);
    if (reading.os) setOs(reading.os);
    setPendingReading(reading);
  }

  useEffect(() => {
    if (!pendingReading || !models.data) return;
    const matched = matchModel(pendingReading, models.data);
    if (matched) setModelCode(matched);
    setPendingReading(null);
  }, [pendingReading, models.data]);

  function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const body = {
      serial: serial.trim(),
      modelCode,
      os,
      ...(color.trim() ? { color: color.trim() } : {}),
      ...(assetNo.trim() ? { assetNo: assetNo.trim() } : {}),
    };
    create.mutate(body, {
      onSuccess: () => navigate("/admin/devices", { state: { notice: "기기를 등록했습니다." } }),
      onError: (e) => setError(e instanceof ApiError ? messageFor(e) : "등록하지 못했습니다."),
    });
  }

  return (
    <section className="max-w-xl">
      <PageHeader back={{ to: "/admin/devices", label: "기기 목록" }} title="기기 등록" description="등록된 기종으로 새 기기를 등록합니다. 라벨 사진을 찍으면 시리얼·기종을 미리 채워 드립니다." />
      {error && <ErrorBanner message={error} />}
      <FormCard onSubmit={submit}>
        <LabelScanner onRead={fillFromLabel} />
        <Field label="시리얼" required maxLength={64} value={serial} onChange={(e) => setSerial(e.target.value)} />
        <SelectField label="기종" required value={modelCode} onChange={(e) => setModelCode(e.target.value)}>
          <option value="">기종을 고르세요</option>
          {models.data?.map((m) => (
            <option key={m.modelCode} value={m.modelCode}>
              {m.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="OS" value={os} onChange={(e) => setOs(e.target.value as DeviceOs)}>
          {Object.entries(DEVICE_OS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
        <Field label="색상(선택)" maxLength={32} value={color} onChange={(e) => setColor(e.target.value)} />
        <Field label="자산번호(선택)" maxLength={64} value={assetNo} onChange={(e) => setAssetNo(e.target.value)} />
        <FormActions>
          <Link className={buttonVariants({ variant: "outline" })} to="/admin/devices">
            취소
          </Link>
          <Button type="submit" busy={create.isPending} disabled={!serial.trim() || !modelCode}>
            등록
          </Button>
        </FormActions>
      </FormCard>
    </section>
  );
}
