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
          "reviewedDate": "2026-10-27"
        }
      ],
      "steps": [
        {
          "stage": "assessment",
          "title": "초기 상태·영양 평가",
          "detail": "체중·BCS·MCS, 식욕, 구토·배변, 부종·복수와 식이 변경 이력을 기록합니다. 호흡·순환 이상이나 심한 전신 악화가 있으면 안정화를 우선합니다.",
          "calculator": "nutrition",
          "offsetHours": 0
        },
        {
          "stage": "tests",
          "title": "단백 소실 평가",
          "detail": "알부민·총단백 추이를 확인하고 신장 단백 소실과 간 합성 저하를 평가합니다. 코발라민, 복부영상과 필요한 장 검사의 우선순위를 정합니다.",
          "calculator": "",
          "offsetHours": 0
        },
        {
          "stage": "differentials",
          "title": "장외 질환·감염·종양 감별",
          "detail": "장외 단백 소실, 감염·기생충, 장 림프관확장과 종양 가능성을 검토합니다. 식이 반응이 없거나 중증이면 내시경·생검 필요성을 재평가합니다.",
          "calculator": "",
          "offsetHours": 0
        },
        {
          "stage": "treatment",
          "title": "식이·검사·치료 계획",
          "detail": "섭취 가능한 식이 시험을 계획합니다. 림프관확장 관련 PLE에서는 저지방 식이를 검토하고 코발라민 결핍을 보완합니다. 면역조절 치료와 혈전 예방은 개별 위험·진단 근거를 검토해 결정합니다.",
          "calculator": "batch",
          "offsetHours": 0
        },
        {
          "stage": "monitoring",
          "title": "반응 추적",
          "detail": "식욕·배변·구토, 체중·근육 상태, 부종과 약물 이상반응을 같은 기준으로 추적합니다. 기저 알부민·영양 지표가 비정상이면 추적 검사와 보고 담당자를 지정합니다.",
          "calculator": "",
          "offsetHours": 0
        },
        {
          "stage": "recheck",
          "title": "재검·보호자 안내",
          "detail": "초기 치료 반응은 대개 1–2주 안에 재평가하되 중증도에 따라 앞당깁니다. 식이 준수·섭취량을 확인하고 악화 시 즉시 연락하도록 안내합니다. 반응 부족 시 진단·치료 계획을 재검토합니다.",
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
          "reviewedDate": "2026-10-27"
        }
      ],
      "steps": [
        {
          "stage": "assessment",
          "title": "산소 전달·안정성 평가",
          "detail": "의식, 호흡·순환 상태와 빈혈 진행 속도를 평가합니다. 수혈 필요성은 PCV 수치 하나가 아니라 산소 전달 부족의 임상 징후를 함께 보고 판단합니다.",
          "calculator": "emergency",
          "offsetHours": 0
        },
        {
          "stage": "tests",
          "title": "용혈·빈혈 추적",
          "detail": "기존 용혈·면역매개 진단 근거를 확인하고 CBC·망상적혈구·혈구용적률·빌리루빈 추적 계획을 정합니다. 수혈 예정이면 혈액형·적합성 평가를 준비합니다.",
          "calculator": "",
          "offsetHours": 0
        },
        {
          "stage": "differentials",
          "title": "유발·동반 질환 확인",
          "detail": "감염 노출·이동력, 복용 약물과 동반 질환을 검토합니다. 면역억제 전 필요한 검체를 확보하고 원인 치료가 필요한 문제를 구분합니다.",
          "calculator": "",
          "offsetHours": 0
        },
        {
          "stage": "treatment",
          "title": "수혈·면역억제·혈전 예방 계획",
          "detail": "수혈과 글루코코르티코이드 기반 면역억제를 환자별로 계획합니다. 추가 면역억제제와 혈전 예방은 출혈·혈소판·혈전 위험을 함께 검토합니다. 약물별 용량·경로는 별도 처방으로 확정합니다.",
          "calculator": "transfusion",
          "offsetHours": 0
        },
        {
          "stage": "monitoring",
          "title": "반응·부작용 평가",
          "detail": "빈혈·용혈 추이, 수혈 반응, 감염과 약물 이상반응을 기록합니다. 갑작스러운 호흡·신경·순환 변화는 즉시 재평가합니다. 약제별 혈구·생화학 감시 계획을 설정합니다.",
          "calculator": "",
          "offsetHours": 0
        },
        {
          "stage": "recheck",
          "title": "감량·재발 대응",
          "detail": "임상 및 검사상 관해를 확인하며 단계적으로 감량합니다. 감량 전 재검과 재발 시 대응을 정하고 혈전 예방 종료 시점도 함께 검토합니다. 임의 중단을 피하도록 안내합니다.",
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
          "reviewedDate": "2026-10-27"
        }
      ],
      "steps": [
        {
          "stage": "assessment",
          "title": "탈수·통증·섭취 평가",
          "detail": "고양이의 섭취량·식욕 저하 기간, 탈수·관류, 통증, 구토와 전신 상태를 기록합니다. 구토가 없더라도 췌장염을 배제하지 않습니다.",
          "calculator": "",
          "offsetHours": 0
        },
        {
          "stage": "tests",
          "title": "검사·영상 대조",
          "detail": "임상 소견, 췌장 특이 리파아제와 초음파를 종합합니다. 검사 하나만으로 확진·배제하지 않고 혈구·생화학·전해질 이상을 함께 평가합니다.",
          "calculator": "",
          "offsetHours": 0
        },
        {
          "stage": "differentials",
          "title": "동반 질환 평가",
          "detail": "간담도·장 질환, 당뇨 등 동반 문제를 확인합니다. 검사 결과가 서로 맞지 않으면 재평가 계획을 세우고 다른 식욕부진 원인도 검토합니다.",
          "calculator": "",
          "offsetHours": 0
        },
        {
          "stage": "treatment",
          "title": "지지요법 계획",
          "detail": "개별 수액·진통·항구토 계획을 정하고 조기 경장 영양을 지원합니다. 섭취 부족 시 급식관을 검토하며 관행적 장기 금식을 피합니다. 항생제는 감염 근거가 있을 때 검토하고 급성 췌장염에 스테로이드를 일률 적용하지 않습니다.",
          "calculator": "fluid",
          "offsetHours": 0
        },
        {
          "stage": "monitoring",
          "title": "섭취·수분·반응 기록",
          "detail": "실제 섭취량, 구토·통증, 체중·수분 상태와 전해질을 추적합니다. 수액 중 호흡수·노력의 변화를 관찰하고 과부하가 의심되면 즉시 처방을 재평가합니다.",
          "calculator": "nutrition",
          "offsetHours": 0
        },
        {
          "stage": "recheck",
          "title": "퇴원·재평가",
          "detail": "통증·구토 조절, 안정적인 섭취와 수분 상태를 바탕으로 퇴원·재검을 결정합니다. 급식·약물 계획과 식욕 재저하, 호흡 변화 등 조기 연락 기준을 설명합니다.",
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
          "reviewedDate": "2026-10-27"
        }
      ],
      "steps": [
        {
          "stage": "assessment",
          "title": "중증도·관류·수분 평가",
          "detail": "의식·관류·탈수와 전신 상태를 평가합니다. 지속 감시와 반복 검사가 가능한지 확인하고 중환자 관리가 어려우면 전원을 검토합니다.",
          "calculator": "fluid",
          "offsetHours": 0
        },
        {
          "stage": "tests",
          "title": "혈당·케톤·산염기 확인",
          "detail": "고혈당뿐 아니라 케톤증과 산증을 확인합니다. 혈중 BHB, 전해질과 산염기 검사를 확보하고 치료 전후 변화를 비교할 기준 시각을 기록합니다.",
          "calculator": "",
          "offsetHours": 0
        },
        {
          "stage": "differentials",
          "title": "유발 질환 평가",
          "detail": "췌장염, 감염, 신장 질환 등 유발·동반 문제와 기존 인슐린 투여 누락·방법을 검토합니다. 필요한 검사를 안정화와 병행합니다.",
          "calculator": "",
          "offsetHours": 0
        },
        {
          "stage": "treatment",
          "title": "수액·인슐린·전해질 계획",
          "detail": "관류·수분 회복과 전해질 평가를 먼저 시작하고 특히 칼륨 상태를 확인한 뒤 인슐린 계획을 확정합니다. 혈당 감소에 맞춘 포도당 보충·전해질 처방은 담당 수의사가 조정합니다.",
          "calculator": "potassium",
          "offsetHours": 0
        },
        {
          "stage": "monitoring",
          "title": "치료 반응·변동 추적",
          "detail": "혈당은 초기 1–2시간 간격 평가를 검토하고 중증도에 맞춰 케톤·전해질·산염기·수분 상태를 반복 확인합니다. 혈당 정상화만으로 DKA 해소를 판단하지 않습니다. 측정·보고 간격을 원내 지시로 지정합니다.",
          "calculator": "",
          "offsetHours": 0
        },
        {
          "stage": "recheck",
          "title": "유지 치료 전환",
          "detail": "케톤증·임상 상태 개선, 수분 회복과 자발 섭취를 확인하며 유지 인슐린 전환을 계획합니다. 보호자에게 투여법·저혈당 대응·재검 일정과 식욕 소실·구토 시 연락 기준을 안내합니다.",
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
          "title": "IRIS CKD 병기·치료 권고 · 2026",
          "url": "https://www.iris-kidney.com/iris-guidelines-1",
          "reviewedDate": "2026-10-27"
        }
      ],
      "steps": [
        {
          "stage": "assessment",
          "title": "안정 상태·기록 대조",
          "detail": "체중·근육 상태, 섭취·음수·배뇨, 수분 상태와 현재 약물을 기록합니다. 급성 악화가 있으면 안정화 후 만성 경과와 구분합니다.",
          "calculator": "",
          "offsetHours": 0
        },
        {
          "stage": "tests",
          "title": "신장 지표·단백뇨·혈압",
          "detail": "CKD 진단 후 안정적인 환자에서 크레아티닌·SDMA를 반복 평가해 병기를 정합니다. 단백뇨와 혈압으로 하위 분류하고 단일 탈수 시점 수치만으로 병기를 확정하지 않습니다.",
          "calculator": "",
          "offsetHours": 0
        },
        {
          "stage": "differentials",
          "title": "CKD 진단·단계 재확인",
          "detail": "신전성·신후성 원인과 급성 신손상 또는 CKD의 급성 악화 가능성을 검토합니다. 검사 변화와 병력에 맞춰 원인 평가를 보완합니다.",
          "calculator": "",
          "offsetHours": 0
        },
        {
          "stage": "treatment",
          "title": "동물종·단계별 치료",
          "detail": "개·고양이별 IRIS 권고와 병기에 따라 식이·수분, 혈압·단백뇨, 인·칼륨, 빈혈과 임상 증상 관리 필요성을 검토합니다. 신장 배설 약물은 이익·위험과 모니터링 계획을 확인합니다.",
          "calculator": "nutrition",
          "offsetHours": 0
        },
        {
          "stage": "monitoring",
          "title": "연속 검사·반응 추적",
          "detail": "체중·섭취·수분 상태, 신장 지표와 치료 대상 이상을 연속 추적합니다. 약물 변경 후 필요한 혈압·전해질·신장 지표 재검 시점을 처방과 함께 기록합니다.",
          "calculator": "",
          "offsetHours": 0
        },
        {
          "stage": "recheck",
          "title": "재검·보호자 관찰",
          "detail": "병기와 반응에 맞춰 재검 간격·목표를 정합니다. 진행 또는 안정화에 따라 계획을 조정하고 섭취 감소·구토·배뇨 변화 등 악화 시 연락 기준을 안내합니다.",
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
          "reviewedDate": "2026-10-27"
        }
      ],
      "steps": [
        {
          "stage": "assessment",
          "title": "호흡·순환 상태",
          "detail": "개 MMVD 환자의 호흡수·노력과 순환 상태를 우선 평가합니다. 현재 또는 과거 CHF가 있는 Stage C와 무증상 B2를 구분하며 고양이 심근병증에 그대로 적용하지 않습니다.",
          "calculator": "emergency",
          "offsetHours": 0
        },
        {
          "stage": "tests",
          "title": "울혈·심장 평가",
          "detail": "호흡 안정성을 고려해 흉부영상·심장초음파 등으로 울혈과 심장 상태를 평가합니다. 신장 기능·전해질·혈압의 치료 전 기준값을 확보합니다.",
          "calculator": "",
          "offsetHours": 0
        },
        {
          "stage": "differentials",
          "title": "심부전 단계·다른 호흡기 원인",
          "detail": "호흡기 질환 등 비심장성 호흡곤란과 동반 질환을 검토합니다. 기침만으로 울혈성 심부전을 단정하지 않고 검사와 임상 경과를 대조합니다.",
          "calculator": "",
          "offsetHours": 0
        },
        {
          "stage": "treatment",
          "title": "급성·유지 치료 계획",
          "detail": "급성 호흡곤란은 스트레스를 줄이며 산소·이뇨 치료 등 안정화를 개별 처방합니다. 만성 Stage C 치료는 단계·신장 상태·전해질을 검토해 결정하며 관행적 수액 투여를 피합니다.",
          "calculator": "batch",
          "offsetHours": 0
        },
        {
          "stage": "monitoring",
          "title": "호흡·신장·전해질 변화",
          "detail": "호흡 상태, 체중·식욕, 수분 상태와 신장·전해질 변화를 추적합니다. 이뇨제·ACE 억제제 시작 또는 조정 후 대개 3–14일 내 재검을 검토하고 불안정하면 앞당깁니다.",
          "calculator": "",
          "offsetHours": 0
        },
        {
          "stage": "recheck",
          "title": "퇴원·호흡 관찰",
          "detail": "집에서 안정 시 호흡수의 개인 기준과 추이를 기록하도록 안내합니다. 호흡 노력 증가·실신·급격한 악화 시 즉시 연락하며 투약 순응도와 재검 일정을 확인합니다.",
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
          "reviewedDate": "2026-10-27"
        }
      ],
      "steps": [
        {
          "stage": "assessment",
          "title": "발작 시간·반복·의식 확인",
          "detail": "발작 시작·종료 시각, 반복 횟수와 의식 회복 여부를 기록합니다. 5분 이상 지속하거나 의식 회복 없이 반복되면 응급 경로로 대응합니다.",
          "calculator": "emergency",
          "offsetHours": 0
        },
        {
          "stage": "tests",
          "title": "원인·합병증 평가",
          "detail": "기도·호흡·순환과 체온을 감시하며 가역적 원인 평가에 필요한 검사를 병행합니다. 안정화 후 병력·기존 항경련제와 추가 신경학적 평가 계획을 정합니다.",
          "calculator": "",
          "offsetHours": 0
        },
        {
          "stage": "differentials",
          "title": "발작 지속 여부 재평가",
          "detail": "유발 원인과 동반 합병증을 검토합니다. 운동성 발작이 멈춰도 의식 이상이 지속되면 비경련성 발작 가능성을 포함해 재평가합니다.",
          "calculator": "",
          "offsetHours": 0
        },
        {
          "stage": "treatment",
          "title": "단계별 항발작 치료",
          "detail": "벤조디아제핀을 포함한 초기 응급 치료 후 반응에 따라 장시간 작용 약물·불응성 발작 치료로 단계적으로 진행합니다. 개·고양이별 근거 차이를 확인하고 약물·경로·용량을 개별 확정합니다.",
          "calculator": "cri",
          "offsetHours": 0
        },
        {
          "stage": "monitoring",
          "title": "재발·호흡·순환 감시",
          "detail": "발작 시각·지속시간, 의식 회복, 투약 시각과 반응을 같은 시간축에 기록합니다. 호흡·순환·체온과 치료 합병증을 감시하며 재발 시 다음 단계 처방을 확인합니다.",
          "calculator": "",
          "offsetHours": 0
        },
        {
          "stage": "recheck",
          "title": "유지·감량·응급 재방문",
          "detail": "안정화 후 유지 치료와 감량 여부를 검토합니다. 보호자에게 발작 기록법·응급 방문 기준·처방된 구조약 사용법을 설명하고 재검·투약 계획을 확인합니다.",
          "calculator": "batch",
          "offsetHours": 0
        }
      ]
    }
  }
];if(typeof module==='object'&&module.exports)module.exports=items;else g.ClinicalProtocolStarters=items;})(typeof window==='undefined'?globalThis:window);
