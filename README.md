# 지금 제주 날씨는?

1. `start.cmd`를 더블클릭합니다. 앱 실행 창과 기본 브라우저가 열립니다. 실행 창은 앱 사용 중 열어 둡니다.
2. 화면 아래 연결 설정에 본인의 WeatherAPI.com API 키를 입력하고 **연결하기**를 누릅니다.
3. **새로고침**을 누르면 날씨를 다시 요청합니다. 저장된 키가 있으면 화면을 열 때 자동으로 조회합니다.

접속 주소: http://127.0.0.1:8765

키 발급: https://www.weatherapi.com/signup.aspx

기존 `index.html` 화면에 입력한 키는 새 주소에서 다시 입력해야 합니다. 브라우저 저장소는 주소마다 구분됩니다.

- HTML, CSS, JavaScript와 Node.js 기본 모듈을 사용하는 개인 학습용 앱입니다. Node.js가 필요하며 추가 패키지 설치와 빌드는 필요 없습니다.
- 로컬 서버가 브라우저 대신 WeatherAPI를 호출합니다. 키는 POST 요청 본문으로 전달하고 서버 파일이나 로그에 기록하지 않습니다.
- `index.html`을 직접 열어서 사용하는 방식도 유지하지만, 브라우저의 외부 API 통신이 제한된다면 `start.cmd`로 실행합니다.
- `https://api.weatherapi.com/v1/current.json`을 제주 시내 좌표 `33.4996,126.5312`, `lang=ko`로 호출합니다.
- 기온(`temp_c`), 습도(`humidity`), 날씨 설명(`condition.text`), 업데이트 시각(`last_updated`)을 표시합니다.
- 날씨 수치는 API 응답만 표시하며, 연결 전에는 빈 값으로 표시합니다.
- 키는 기본적으로 현재 탭의 sessionStorage에 보관합니다. ‘이 브라우저에 키 기억하기’를 선택하면 localStorage에 보관합니다.
- API 키는 본인 브라우저에 보관되며, 로컬 서버는 이 컴퓨터의 127.0.0.1에서만 접속할 수 있습니다.

공식 문서: https://www.weatherapi.com/docs/
