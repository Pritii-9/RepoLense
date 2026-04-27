import sqlite3
conn = sqlite3.connect('repolens.db')
c = conn.cursor()
c.execute('UPDATE users SET is_verified = 1 WHERE email = "test4@example.com"')
conn.commit()
print('User verified in backend db')
conn.close()