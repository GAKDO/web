// 개인정보처리방침·이용약관(11/10): Google·GitHub 소셜 로그인 앱을 게시하려면 공개 주소가 있어야 한다
import type { ReactNode } from "react";

/** 공지 날짜. 내용을 바꾸면 함께 바꾼다 */
const EFFECTIVE_DATE = "2026년 11월 10일";

function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 md:px-8 md:py-16">
      <h1 className="m-0 text-2xl font-bold">{title}</h1>
      <p className="mt-2 mb-0 text-sm text-muted-foreground">시행일: {EFFECTIVE_DATE}</p>
      <div className="mt-8 space-y-6 leading-relaxed [&_h2]:m-0 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:m-0 [&_p]:mt-2 [&_ul]:mt-2 [&_ul]:pl-5">
        {children}
      </div>
    </main>
  );
}

export function PrivacyPage() {
  return (
    <LegalPage title="개인정보처리방침">
      <p>
        TRACE(노트북 렌탈 상태 기록 서비스, 조선대학교 캡스톤 프로젝트 팀 GAKDO)는 서비스에 필요한 최소한의 개인정보만 수집하고,
        아래 목적 밖으로 쓰지 않습니다. 외부 서비스로 보내는 경우는 4절에 적은 것뿐입니다.
      </p>
      <section>
        <h2>1. 수집하는 항목</h2>
        <ul>
          <li>회원 정보: 이메일, 이름(또는 표시 이름), 비밀번호의 해시값</li>
          <li>소셜 로그인(Google·GitHub·카카오·네이버): 제공자가 인증한 이메일, 이름, 제공자의 사용자 번호. 제공자의 비밀번호나 토큰은 저장하지 않습니다.</li>
          <li>렌탈 기록: 대여한 노트북, 수령·반납 시점의 상태 사진, 흠집 검사 결과, 진단 결과(배터리·저장장치 등 기기 정보)</li>
          <li>
            렌탈 관리 정보: 관리자가 렌탈을 만들 때 적는 고객 이름(또는 고객사 이름)과 반납 예정일, 관리자 메모. 고객 이름은 관리자와 본인에게만 보이고
            공개 기기 목록에는 나가지 않습니다. 메모는 관리자만 봅니다.
          </li>
          <li>로그인 유지용 쿠키(리프레시 토큰)</li>
        </ul>
      </section>
      <section>
        <h2>2. 이용 목적</h2>
        <ul>
          <li>회원 확인과 로그인</li>
          <li>렌탈 시점별 노트북 상태 기록과 리포트 제공</li>
          <li>대여 고객 확인과 반납 일정 관리</li>
          <li>서비스 관련 안내 메일(인증 코드, 기록 봉인 영수증 등) 발송</li>
        </ul>
      </section>
      <section>
        <h2>3. 보관 기간과 파기</h2>
        <p>
          회원 정보는 탈퇴할 때까지 보관합니다. 탈퇴하면 이메일·이름·비밀번호를 바로 지우고, 소셜 로그인 연결도 함께 끊깁니다. 렌탈 기록은
          대여 이력 확인을 위해 계정과 분리된 형태로 남을 수 있습니다. 프로젝트가 끝나면 서비스 데이터 전체를 지웁니다.
        </p>
      </section>
      <section>
        <h2>4. 제3자 제공·위탁</h2>
        <p>개인정보를 제3자에게 팔지 않습니다. 서비스에 꼭 필요한 아래 경우에만 외부 서비스를 씁니다.</p>
        <ul>
          <li>메일 발송: Gmail</li>
          <li>
            사이트 도우미(오른쪽 아래 챗봇): 질문과 최근 대화를 Google Gemini API로 보내 답을 만듭니다. 로그인한 상태에서 렌탈·검사에 대해 물으면 내
            렌탈 정보와 검사 결과도 함께 보냅니다. 대화는 TRACE 서버에 저장하지 않으며, 개인정보는 질문에 적지 말아 주세요.
          </li>
        </ul>
      </section>
      <section>
        <h2>5. 이용자의 권리</h2>
        <p>
          언제든 <a href="/my/account">내 계정</a>에서 정보를 확인하고 탈퇴할 수 있습니다. 소셜 로그인 연결은 각 제공자의 계정 설정에서도 해제할 수
          있습니다. 소셜 로그인으로 가입해 비밀번호가 없는 계정은 로그인한 지 10분 안에 비밀번호 대신 &quot;탈퇴&quot;를 입력해 탈퇴할 수 있고, 탈퇴하면
          소셜 로그인 연결도 함께 지워집니다.
        </p>
      </section>
      <section>
        <h2>6. 문의</h2>
        <p>개인정보 관련 문의는 팀 GAKDO(https://github.com/GAKDO)로 해 주세요.</p>
      </section>
    </LegalPage>
  );
}

export function TermsPage() {
  return (
    <LegalPage title="이용약관">
      <section>
        <h2>1. 서비스</h2>
        <p>
          TRACE는 노트북 렌탈의 수령·반납 시점 상태를 사진과 진단으로 기록하는 서비스입니다. 조선대학교 캡스톤 프로젝트로 운영하는 시범
          서비스이며, 사전 안내 없이 바뀌거나 끝날 수 있습니다.
        </p>
      </section>
      <section>
        <h2>2. 계정</h2>
        <p>
          이메일 가입이나 소셜 로그인(Google·GitHub·카카오·네이버)으로 계정을 만들 수 있습니다. 본인의 계정만 사용하고, 로그인 정보를 다른 사람과
          나누지 마세요.
        </p>
      </section>
      <section>
        <h2>3. 기록</h2>
        <p>
          검사 결과(흠집 판정·등급)는 AI 판정과 관리자 검수를 거친 참고 정보이며, 실제 렌탈 계약의 책임 판단은 렌탈 업체와 이용자 사이의 약정을
          따릅니다.
        </p>
      </section>
      <section>
        <h2>4. 금지 행위</h2>
        <p>서비스를 방해하거나, 남의 계정·기록에 접근하려 하거나, 기록을 조작하려는 행위는 금지되며 계정이 정지될 수 있습니다.</p>
      </section>
      <section>
        <h2>5. 개인정보</h2>
        <p>
          개인정보 처리는 <a href="/privacy">개인정보처리방침</a>을 따릅니다.
        </p>
      </section>
    </LegalPage>
  );
}
