import re, glob

bad = "{{" + "SECRET_" + "wcmjtmlz}}"
for p in glob.glob('src/**/*.js', recursive=True):
    s = open(p, encoding='utf-8').read()
    if bad in s:
        s = s.replace(bad, "darkSteel")
        open(p, 'w', encoding='utf-8').write(s)
        print('fixed', p, s.count('darkSteel'))
    if '{{' in s:
        for m in re.finditer(r'\{\{[^}]*\}\}', s):
            print('LEFTOVER', p, m.group(0))
print('done')
