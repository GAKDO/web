import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { DeviceFormFactor, DeviceModel, DeviceModelUpsertRequest } from "../../../shared/api/types";
import { ApiError } from "../../../shared/api/problem";
import { messageFor } from "../../../shared/api/errorMessages";
import { DEVICE_FORM_FACTOR_LABEL } from "../../../shared/codes/labels";
import { Button } from "../../../shared/ui/Button";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner";
import { Field, SelectField } from "../../../shared/ui/Field";
import { useDeviceModels } from "../../devices/api/devices";
import { useDeviceModel, useUpsertDeviceModel } from "../api/models";

// 기종 코드 규칙은 contracts rental-server.yaml ModelCode와 같다
const MODEL_CODE = /^[A-Z0-9][A-Z0-9-]{1,63}$/;

interface FormValues {
  modelCode: string;
  name: string;
  manufacturer: string;
  formFactor: DeviceFormFactor;
  cpu: string;
  ramGb: string;
  ssdGb: string;
  widthMm: string;
  depthMm: string;
  baseHMm: string;
  lidHMm: string;
}

type Errors = Partial<Record<keyof FormValues, string>>;

const EMPTY: FormValues = {
  modelCode: "",
  name: "",
  manufacturer: "",
  formFactor: "CLAMSHELL",
  cpu: "",
  ramGb: "",
  ssdGb: "",
  widthMm: "",
  depthMm: "",
  baseHMm: "",
  lidHMm: "",
};

function fromModel(m: DeviceModel): FormValues {
  return {
    modelCode: m.modelCode,
    name: m.name,
    manufacturer: m.manufacturer ?? "",
    formFactor: m.formFactor,
    cpu: m.spec?.cpu ?? "",
    ramGb: m.spec?.ramGb?.toString() ?? "",
    ssdGb: m.spec?.ssdGb?.toString() ?? "",
    widthMm: String(m.dimensions.widthMm),
    depthMm: String(m.dimensions.depthMm),
    baseHMm: String(m.dimensions.baseHMm),
    lidHMm: String(m.dimensions.lidHMm),
  };
}

/** 칸 값을 검사해 보낼 본문을 만든다. 틀린 칸이 있으면 errors만 돌려준다 */
export function toRequest(v: FormValues): { body?: DeviceModelUpsertRequest; errors: Errors } {
  const errors: Errors = {};
  if (!MODEL_CODE.test(v.modelCode)) errors.modelCode = "영문 대문자·숫자·하이픈(-)으로 2~64자, 예: MBA13-M2";
  if (!v.name.trim()) errors.name = "이름을 적어 주세요.";
  const dims = {} as DeviceModelUpsertRequest["dimensions"];
  for (const key of ["widthMm", "depthMm", "baseHMm", "lidHMm"] as const) {
    const n = Number(v[key]);
    if (!v[key].trim() || !Number.isFinite(n) || n <= 0) errors[key] = "0보다 큰 mm 값을 적어 주세요.";
    else dims[key] = n;
  }
  const spec: NonNullable<DeviceModelUpsertRequest["spec"]> = {};
  if (v.cpu.trim()) spec.cpu = v.cpu.trim();
  for (const key of ["ramGb", "ssdGb"] as const) {
    if (!v[key].trim()) continue;
    const n = Number(v[key]);
    if (!Number.isInteger(n) || n < 1) errors[key] = "1 이상의 정수(GB)로 적어 주세요.";
    else spec[key] = n;
  }
  if (Object.keys(errors).length > 0) return { errors };
  return {
    errors,
    body: {
      name: v.name.trim(),
      ...(v.manufacturer.trim() ? { manufacturer: v.manufacturer.trim() } : {}),
      formFactor: v.formFactor,
      ...(Object.keys(spec).length > 0 ? { spec } : {}),
      dimensions: dims,
    },
  };
}

/** 기종 등록(/admin/models/new)과 고치기(/admin/models/:modelCode/edit, 코드가 NEW여도 겹치지 않게). 3D 트윈·촬영 윤곽이 이 치수를 쓴다(FR-RNT-03) */
export function ModelEditPage() {
  const { modelCode: editing } = useParams();
  const navigate = useNavigate();
  const existing = useDeviceModel(editing);
  const list = useDeviceModels();
  const save = useUpsertDeviceModel();
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existing.data) setValues(fromModel(existing.data));
  }, [existing.data]);

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const { body, errors: found } = toRequest(values);
    setErrors(found);
    if (!body) return;
    // PUT은 있으면 덮어쓰므로, 새로 등록할 때는 이미 있는 코드인지 먼저 본다
    if (!editing && list.data?.some((m) => m.modelCode === values.modelCode)) {
      setErrors({ modelCode: "이미 있는 기종 코드입니다. 기종 목록에서 고치기를 눌러 주세요." });
      return;
    }
    save.mutate(
      { modelCode: values.modelCode, body },
      {
        onSuccess: () => navigate("/admin/models"),
        onError: (e) => setError(e instanceof ApiError ? messageFor(e) : "저장하지 못했습니다."),
      },
    );
  }

  if (editing && existing.isPending) return <p>불러오는 중…</p>;
  if (editing && existing.isError) {
    return (
      <section className="narrow">
        <h1>기종 고치기</h1>
        <ErrorBanner
          message={existing.error instanceof ApiError ? messageFor(existing.error) : "기종을 불러오지 못했습니다."}
          onRetry={() => void existing.refetch()}
        />
        <Link className="button-link" to="/admin/models">
          기종 목록으로
        </Link>
      </section>
    );
  }

  const field = (key: keyof FormValues) => ({
    value: values[key],
    error: errors[key],
    onChange: (e: { target: { value: string } }) => setValues((prev) => ({ ...prev, [key]: e.target.value })),
  });

  return (
    <section className="narrow">
      <h1>{editing ? "기종 고치기" : "기종 등록"}</h1>
      {error && <ErrorBanner message={error} />}
      <form onSubmit={submit} noValidate>
        <Field
          label="기종 코드"
          required
          maxLength={64}
          readOnly={!!editing}
          placeholder="MBA13-M2"
          {...field("modelCode")}
          onChange={(e) => set("modelCode", e.target.value.toUpperCase())}
        />
        <Field label="이름" required maxLength={128} placeholder="MacBook Air (M2, 2022)" {...field("name")} />
        <Field label="제조사(선택)" maxLength={64} {...field("manufacturer")} />
        <SelectField label="형태" value={values.formFactor} onChange={(e) => set("formFactor", e.target.value as DeviceFormFactor)}>
          {Object.entries(DEVICE_FORM_FACTOR_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
        <fieldset>
          <legend>치수(mm) — 3D 리포트와 촬영 윤곽이 씁니다</legend>
          <Field label="가로(mm)" required inputMode="decimal" {...field("widthMm")} />
          <Field label="세로(mm)" required inputMode="decimal" {...field("depthMm")} />
          <Field label="본체 두께(mm)" required inputMode="decimal" {...field("baseHMm")} />
          <Field label="덮개 두께(mm)" required inputMode="decimal" {...field("lidHMm")} />
        </fieldset>
        <fieldset>
          <legend>기준 사양(선택) — 진단 비교에 씁니다</legend>
          <Field label="CPU" maxLength={64} placeholder="Apple M2" {...field("cpu")} />
          <Field label="메모리(GB)" inputMode="numeric" {...field("ramGb")} />
          <Field label="저장 공간(GB)" inputMode="numeric" {...field("ssdGb")} />
        </fieldset>
        <div className="row">
          <Link className="button-link" to="/admin/models">
            취소
          </Link>
          {/* 새로 등록할 때는 코드 중복을 보려고 기종 목록을 받은 뒤에 저장을 켠다 */}
          <Button type="submit" busy={save.isPending} disabled={!editing && !list.isSuccess}>
            저장
          </Button>
        </div>
      </form>
    </section>
  );
}
