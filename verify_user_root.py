import sqlite3
conn = sqlite3.connect('../repolens.db')
c = conn.cursor()
c.execute('SELECT email, is_verified FROM users')
print('Users:', c.fetchall())
c.execute('UPDATE users SET is_verified = 1 WHERE email = "test4@example.com"')
conn.commit()
print('User verified in root db')
conn.close()