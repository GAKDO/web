import { maskSerial } from "../../../shared/ui/maskSerial";
import { MaskedSerial } from "../../../shared/ui/MaskedSerial";
import { useState, type FormEvent } from "react";
import type { Device, DeviceOs } from "../../../shared/api/types";
import { ApiError } from "../../../shared/api/problem";
import { messageFor } from "../../../shared/api/errorMessages";
import { DEVICE_OS_LABEL } from "../../../shared/codes/labels";
import { Button } from "../../../shared/ui/Button";
import { Field, SelectField } from "../../../shared/ui/Field";
import { useUpdateDevice } from "../api/devices";

/** 기기 정보 고치기. 시리얼·기종은 읽기 전용(FR-012) */
export function DeviceEditor({ device, onDone }: { device: Device; onDone: () => void }) {
  const update = useUpdateDevice();
  const [color, setColor] = useState(device.color ?? "");
  const [assetNo, setAssetNo] = useState(device.assetNo ?? "");
  const [os, setOs] = useState<DeviceOs>(device.os);
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const body = { color: color.trim() || null, assetNo: assetNo.trim() || null, os };
    update.mutate(
      { deviceId: device.deviceId, body },
      {
        onSuccess: onDone,
        onError: (e) => setError(e instanceof ApiError ? messageFor(e) : "저장하지 못했습니다."),
      },
    );
  }

  return (
    <form className="grid gap-x-3 md:grid-cols-2" onSubmit={submit} aria-label={`${maskSerial(device.serial)} 고치기`}>
      <div className="mb-4 grid gap-2">
        <span className="text-sm font-medium">시리얼</span>
        <MaskedSerial serial={device.serial} className="min-h-9" />
      </div>
      <Field label="기종" value={device.modelName} readOnly disabled />
      <SelectField label="OS" value={os} onChange={(e) => setOs(e.target.value as DeviceOs)}>
        {Object.entries(DEVICE_OS_LABEL).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </SelectField>
      <Field label="색상" maxLength={32} value={color} onChange={(e) => setColor(e.target.value)} />
      <Field label="자산번호" maxLength={64} value={assetNo} error={error} onChange={(e) => setAssetNo(e.target.value)} />
      <div className="col-span-full flex flex-wrap gap-2">
        <Button onClick={onDone}>취소</Button>
        <Button type="submit" busy={update.isPending}>
          저장
        </Button>
      </div>
    </form>
  );
}
