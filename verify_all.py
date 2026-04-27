import sqlite3
conn = sqlite3.connect('repolens.db')
c = conn.cursor()
c.execute('SELECT email, is_verified FROM users')
print('Users:', c.fetchall())
c.execute('UPDATE users SET is_verified = 1')
conn.commit()
print('All users verified')
conn.close()