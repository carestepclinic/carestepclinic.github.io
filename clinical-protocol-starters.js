/* Source-linked clinician-editable workflow starters; never published automatically. */
(function(g){const items=[
  {
    "id": "ple",
    "body": {
      "title": "PLE · 개 단백소실성 장질환",
      "disease": "PLE",
      "species": "dog",
      "summary": "저알부민혈증과 만성 위장관 증상이 있는 개의 평가 초안. 장외 단백 소실·합성 저하 원인을 먼저 검토합니다. 고양이로 확대 적용하지 않습니다. 원내 검토 전 초안이며, 각 단계의 예정 시간·검사·처방은 적용 전에 설정해야 합니다.",
      "trainingVersionId": "",
      "sources": [
        {
          "title": "ACVIM CIE 합의문 · 2026",
          "url": "https://doi.org/10.1093/jvimsj/aalaf017",
          "reviewedDate": "2026-10-26"
        }
      ],
      "steps": [
        {
          "stage": "assessment",
          "title": "초기 상태·영양 평가",
          "detail": "체중 변화, 식이 이력, 근육 소실, 배변·구토와 전신 상태를 기록합니다.",
          "calculator": "nutrition",
          "offsetHours": 0
        },
        {
          "stage": "tests",
          "title": "단백 소실 평가",
          "detail": "알부민·총단백과 병력에 맞는 검사·영상 계획을 확정합니다.",
          "calculator": "",
          "offsetHours": 0
        },
        {
          "stage": "differentials",
          "title": "장외 질환·감염·종양 감별",
          "detail": "신장·간담도·췌장 질환, 장 감염과 종양을 감별합니다.",
          "calculator": "",
          "offsetHours": 0
        },
        {
          "stage": "treatment",
          "title": "식이·검사·치료 계획",
          "detail": "식이 시험 여부와 내시경·생검 필요성을 개별 판단하고 확정한 약물만 계산합니다.",
          "calculator": "batch",
          "offsetHours": 0
        },
        {
          "stage": "monitoring",
          "title": "반응 추적",
          "detail": "임상 증상, 체중·영양과 기저 이상이 있던 단백·영양 지표의 추적 계획을 기록합니다.",
          "calculator": "",
          "offsetHours": 0
        },
        {
          "stage": "recheck",
          "title": "재검·보호자 안내",
          "detail": "재검 날짜, 식이 준수와 악화 시 연락 기준을 정합니다.",
          "calculator": "",
          "offsetHours": 0
        }
      ]
    }
  },
  {
    "id": "imha",
    "body": {
      "title": "IMHA · 개 면역매개성 용혈성 빈혈",
      "disease": "IMHA",
      "species": "dog",
      "summary": "개 IMHA 진단·치료 계획 검토용 초안. 빈혈 정도만으로 수혈·면역억제제를 자동 결정하지 않습니다. 원내 검토 전 초안이며, 각 단계의 예정 시간·검사·처방은 적용 전에 설정해야 합니다.",
      "trainingVersionId": "",
      "sources": [
        {
          "title": "ACVIM IMHA 치료 합의문 · 2019",
          "url": "https://doi.org/10.1111/jvim.15463",
          "reviewedDate": "2026-10-26"
        }
      ],
      "steps": [
        {
          "stage": "assessment",
          "title": "산소 전달·안정성 평가",
          "detail": "현재 임상 상태와 빈혈 진행을 평가하고 안정화 우선순위를 정합니다.",
          "calculator": "emergency",
          "offsetHours": 0
        },
        {
          "stage": "tests",
          "title": "용혈·빈혈 추적",
          "detail": "CBC·혈구 지표와 기존 진단 근거, 추적 검사를 확인합니다.",
          "calculator": "",
          "offsetHours": 0
        },
        {
          "stage": "differentials",
          "title": "유발·동반 질환 확인",
          "detail": "지역·생활·이동 이력에 따른 감염 가능성과 동반 질환을 검토합니다.",
          "calculator": "",
          "offsetHours": 0
        },
        {
          "stage": "treatment",
          "title": "수혈·면역억제·혈전 예방 계획",
          "detail": "각 치료의 적응증과 위험을 검토하고 환자별 처방을 확정합니다.",
          "calculator": "transfusion",
          "offsetHours": 0
        },
        {
          "stage": "monitoring",
          "title": "반응·부작용 평가",
          "detail": "혈구 변화, 감염, 약물 이상반응과 혈전 관련 우려를 재평가합니다.",
          "calculator": "",
          "offsetHours": 0
        },
        {
          "stage": "recheck",
          "title": "감량·재발 대응",
          "detail": "검사와 임상 반응에 따른 감량·재검 계획 및 재발 시 연락 기준을 기록합니다.",
          "calculator": "batch",
          "offsetHours": 0
        }
      ]
    }
  },
  {
    "id": "pancreatitis",
    "body": {
      "title": "췌장염 · 고양이 평가·지지요법",
      "disease": "췌장염",
      "species": "cat",
      "summary": "고양이 췌장염 의심·진단 환자용 초안. 증상·검사·영상 정보를 종합하며 단일 검사만으로 확정하지 않습니다. 원내 검토 전 초안이며, 각 단계의 예정 시간·검사·처방은 적용 전에 설정해야 합니다.",
      "trainingVersionId": "",
      "sources": [
        {
          "title": "ACVIM 고양이 췌장염 합의문 · 2021",
          "url": "https://doi.org/10.1111/jvim.16053",
          "reviewedDate": "2026-10-26"
        }
      ],
      "steps": [
        {
          "stage": "assessment",
          "title": "탈수·통증·섭취 평가",
          "detail": "전신 상태, 통증과 식사량을 확인합니다.",
          "calculator": "",
          "offsetHours": 0
        },
        {
          "stage": "tests",
          "title": "검사·영상 대조",
          "detail": "췌장 특이 검사와 초음파 등을 임상 소견과 함께 해석합니다.",
          "calculator": "",
          "offsetHours": 0
        },
        {
          "stage": "differentials",
          "title": "동반 질환 평가",
          "detail": "위장관·간담도 질환 등 동반 문제를 검토합니다.",
          "calculator": "",
          "offsetHours": 0
        },
        {
          "stage": "treatment",
          "title": "지지요법 계획",
          "detail": "환자별 수액·진통·구토 관리와 영양 계획을 정합니다.",
          "calculator": "fluid",
          "offsetHours": 0
        },
        {
          "stage": "monitoring",
          "title": "섭취·수분·반응 기록",
          "detail": "섭취, 구토, 통증과 수분 상태 및 치료 반응을 추적합니다.",
          "calculator": "nutrition",
          "offsetHours": 0
        },
        {
          "stage": "recheck",
          "title": "퇴원·재평가",
          "detail": "섭취와 임상 경과를 바탕으로 재평가 시점을 정합니다.",
          "calculator": "",
          "offsetHours": 0
        }
      ]
    }
  },
  {
    "id": "dka",
    "body": {
      "title": "DKA · 개 당뇨병성 케톤산증",
      "disease": "DKA",
      "species": "dog",
      "summary": "개 DKA의 입원 평가 초안. 케톤증·산증과 임상 상태를 확인합니다. 인슐린·전해질·수액은 의료진이 개별 처방하며 이 초안에는 자동 용량이 없습니다. 원내 검토 전 초안이며, 각 단계의 예정 시간·검사·처방은 적용 전에 설정해야 합니다.",
      "trainingVersionId": "",
      "sources": [
        {
          "title": "AAHA 개 당뇨 관리 · DKA · 2026",
          "url": "https://www.aaha.org/resources/2026-aaha-diabetes-management-guidelines-for-dogs/section-3-diabetic-ketoacidosis-in-dogs/",
          "reviewedDate": "2026-10-26"
        }
      ],
      "steps": [
        {
          "stage": "assessment",
          "title": "중증도·관류·수분 평가",
          "detail": "의식, 탈수와 전신 상태를 확인하고 치료 가능한 시설·인력 여부를 판단합니다.",
          "calculator": "fluid",
          "offsetHours": 0
        },
        {
          "stage": "tests",
          "title": "혈당·케톤·산염기 확인",
          "detail": "혈당, 케톤(BHB 또는 요검사), 전해질·산염기 정보를 확인합니다.",
          "calculator": "",
          "offsetHours": 0
        },
        {
          "stage": "differentials",
          "title": "유발 질환 평가",
          "detail": "췌장염, 감염, 신장 질환 등 악화 요인을 검토합니다.",
          "calculator": "",
          "offsetHours": 0
        },
        {
          "stage": "treatment",
          "title": "수액·인슐린·전해질 계획",
          "detail": "환자 상태와 측정값에 따른 치료 순서·용량 및 재평가 조건을 확정합니다.",
          "calculator": "potassium",
          "offsetHours": 0
        },
        {
          "stage": "monitoring",
          "title": "치료 반응·변동 추적",
          "detail": "혈당·케톤·전해질·산염기와 수분 균형의 측정 일정 및 변경 기준을 정합니다.",
          "calculator": "",
          "offsetHours": 0
        },
        {
          "stage": "recheck",
          "title": "유지 치료 전환",
          "detail": "섭취·케톤산증 개선과 환자 상태를 확인하고 지속 관리 계획을 마련합니다.",
          "calculator": "batch",
          "offsetHours": 0
        }
      ]
    }
  },
  {
    "id": "ckd",
    "body": {
      "title": "CKD · 만성 신장병 단계별 검토",
      "disease": "CKD",
      "species": "both",
      "summary": "CKD가 진단된 안정된 환자의 단계·하위 분류 검토용 초안. 급성 신손상·탈수 중 수치만으로 CKD 단계를 확정하지 않습니다. 원내 검토 전 초안이며, 각 단계의 예정 시간·검사·처방은 적용 전에 설정해야 합니다.",
      "trainingVersionId": "",
      "sources": [
        {
          "title": "IRIS CKD 단계·치료 권고 · 2026",
          "url": "https://www.iris-kidney.com/iris-guidelines-1",
          "reviewedDate": "2026-10-26"
        }
      ],
      "steps": [
        {
          "stage": "assessment",
          "title": "안정 상태·기록 대조",
          "detail": "종, 체중, 병력과 검사 당시 안정 상태를 확인합니다.",
          "calculator": "",
          "offsetHours": 0
        },
        {
          "stage": "tests",
          "title": "신장 지표·단백뇨·혈압",
          "detail": "크레아티닌·SDMA 추세, 단백뇨와 혈압을 확인합니다.",
          "calculator": "",
          "offsetHours": 0
        },
        {
          "stage": "differentials",
          "title": "CKD 진단·단계 재확인",
          "detail": "CKD 진단 근거를 확인한 뒤 IRIS 단계 및 하위 분류를 기록합니다.",
          "calculator": "",
          "offsetHours": 0
        },
        {
          "stage": "treatment",
          "title": "동물종·단계별 치료",
          "detail": "해당 종의 IRIS 권고를 참고해 영양·수분 및 합병증별 치료를 개별 설정합니다.",
          "calculator": "nutrition",
          "offsetHours": 0
        },
        {
          "stage": "monitoring",
          "title": "연속 검사·반응 추적",
          "detail": "환자별 검사 추세와 치료 반응에 맞게 계획을 조정합니다.",
          "calculator": "",
          "offsetHours": 0
        },
        {
          "stage": "recheck",
          "title": "재검·보호자 관찰",
          "detail": "재검 시점과 식욕·체중·음수·배뇨 등 보호자 관찰 항목을 정합니다.",
          "calculator": "",
          "offsetHours": 0
        }
      ]
    }
  },
  {
    "id": "chf",
    "body": {
      "title": "CHF · 개 MMVD 관련 울혈성 심부전",
      "disease": "CHF / MMVD",
      "species": "dog",
      "summary": "개 MMVD 관련 심부전 검토 초안. 무증상 단계와 현재 울혈을 구분하며 고양이 심근병증으로 확대 적용하지 않습니다. 원내 검토 전 초안이며, 각 단계의 예정 시간·검사·처방은 적용 전에 설정해야 합니다.",
      "trainingVersionId": "",
      "sources": [
        {
          "title": "ACVIM 개 MMVD 진단·치료 합의문 · 2019",
          "url": "https://doi.org/10.1111/jvim.15488",
          "reviewedDate": "2026-10-26"
        }
      ],
      "steps": [
        {
          "stage": "assessment",
          "title": "호흡·순환 상태",
          "detail": "호흡곤란과 현재 안정성을 우선 평가합니다.",
          "calculator": "emergency",
          "offsetHours": 0
        },
        {
          "stage": "tests",
          "title": "울혈·심장 평가",
          "detail": "환자가 허용하는 검사와 영상으로 심장 질환·울혈 여부를 대조합니다.",
          "calculator": "",
          "offsetHours": 0
        },
        {
          "stage": "differentials",
          "title": "심부전 단계·다른 호흡기 원인",
          "detail": "현재 울혈과 이전 심부전 병력 및 다른 호흡곤란 원인을 구분합니다.",
          "calculator": "",
          "offsetHours": 0
        },
        {
          "stage": "treatment",
          "title": "급성·유지 치료 계획",
          "detail": "해당 단계와 환자 상태에 맞는 약물·산소 등 치료를 확정합니다.",
          "calculator": "batch",
          "offsetHours": 0
        },
        {
          "stage": "monitoring",
          "title": "호흡·신장·전해질 변화",
          "detail": "호흡 상태와 치료 반응, 신장·전해질 변화의 확인 계획을 정합니다.",
          "calculator": "",
          "offsetHours": 0
        },
        {
          "stage": "recheck",
          "title": "퇴원·호흡 관찰",
          "detail": "휴식 시 호흡과 악화 시 연락 기준, 약물·재검 계획을 안내합니다.",
          "calculator": "",
          "offsetHours": 0
        }
      ]
    }
  },
  {
    "id": "seizure",
    "body": {
      "title": "발작 · 지속성·군발성 발작 대응",
      "disease": "발작",
      "species": "both",
      "summary": "개·고양이 발작 응급 대응의 단계별 검토 초안. 발작 종료 여부와 원인·합병증 평가를 병행하며 약물별 종 차이를 확인합니다. 원내 검토 전 초안이며, 각 단계의 예정 시간·검사·처방은 적용 전에 설정해야 합니다.",
      "trainingVersionId": "",
      "sources": [
        {
          "title": "ACVIM 지속성·군발성 발작 합의문 · 2024",
          "url": "https://doi.org/10.1111/jvim.16928",
          "reviewedDate": "2026-10-26"
        }
      ],
      "steps": [
        {
          "stage": "assessment",
          "title": "발작 시간·반복·의식 확인",
          "detail": "발작 시작·종료, 반복과 의식 회복 여부를 기록하고 신속히 평가합니다.",
          "calculator": "emergency",
          "offsetHours": 0
        },
        {
          "stage": "tests",
          "title": "원인·합병증 평가",
          "detail": "환자 상태에 따라 원인과 전신 합병증 검사 계획을 확정합니다.",
          "calculator": "",
          "offsetHours": 0
        },
        {
          "stage": "differentials",
          "title": "발작 지속 여부 재평가",
          "detail": "운동 증상이 멈춘 뒤에도 의식 변화가 남으면 지속 발작 가능성을 검토합니다.",
          "calculator": "",
          "offsetHours": 0
        },
        {
          "stage": "treatment",
          "title": "단계별 항발작 치료",
          "detail": "종별 근거와 반응을 확인하며 단계적으로 치료를 결정합니다.",
          "calculator": "cri",
          "offsetHours": 0
        },
        {
          "stage": "monitoring",
          "title": "재발·호흡·순환 감시",
          "detail": "발작 재발, 의식, 호흡·순환 및 투약 반응을 기록합니다.",
          "calculator": "",
          "offsetHours": 0
        },
        {
          "stage": "recheck",
          "title": "유지·감량·응급 재방문",
          "detail": "안정화 후 유지 치료와 감량 기준, 보호자 응급 대응을 계획합니다.",
          "calculator": "batch",
          "offsetHours": 0
        }
      ]
    }
  }
];if(typeof module==='object'&&module.exports)module.exports=items;else g.ClinicalProtocolStarters=items;})(typeof window==='undefined'?globalThis:window);
