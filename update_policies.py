import re

files = ['mobile/lib/ticketPolicy.ts', 'client/src/lib/ticketPolicy.ts']
platforms = {
    'LG': '티켓링크 / LG 트윈스 앱',
    '두산': 'NOL티켓(인터파크) / 두산 베어스 앱',
    '키움': 'NOL티켓(인터파크)',
    'SSG': '티켓링크 / SSG닷컴 / SSG 랜더스 앱',
    'NC': 'NC 다이노스 자체 앱 / 홈페이지 / 티켓링크',
    '롯데': '롯데 자이언츠 공식 앱 / 웹 / 티켓링크',
    'KT': '위잽(wizzap) 앱 / 티켓링크',
    'KIA': '티켓링크 / KIA 타이거즈 앱',
    '한화': '한화이글스 앱 / 티켓링크',
    '삼성': '티켓링크 / 삼성 라이온즈 앱 (티온)',
}

venues = {
    '한화': '대전 한화생명 볼파크'
}

for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    for key, plat in platforms.items():
        if key == '키움':
            search_key = '키움'
        elif key == '롯데':
            search_key = '롯데'
        else:
            search_key = key
            
        pattern = r'(' + search_key + r'[\s\S]*?platform:\s*")(.*?)(")'
        content = re.sub(pattern, r'\g<1>' + plat + r'\g<3>', content, count=1)
        
        if key in venues:
            venue_pattern = r'(' + search_key + r'[\s\S]*?venue:\s*")(.*?)(")'
            content = re.sub(venue_pattern, r'\g<1>' + venues[key] + r'\g<3>', content, count=1)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
