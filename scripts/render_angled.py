import bpy
import os
import math

base_dir = "C:/Users/Enes/Desktop/uzuncarsi"
public_dir = os.path.join(base_dir, "public")

# Render ayarları
bpy.context.scene.render.resolution_x = 1920
bpy.context.scene.render.resolution_y = 1080
bpy.context.scene.render.engine = 'BLENDER_EEVEE_NEXT' if hasattr(bpy.types.Scene, 'eevee') else 'BLENDER_EEVEE'

# Güneşi yatay bir açıya getir
sun = None
for obj in bpy.context.scene.objects:
    if obj.type == 'LIGHT' and obj.data.type == 'SUN':
        sun = obj
        break

if sun:
    sun.rotation_euler = (math.radians(60), math.radians(45), 0)
    sun.data.energy = 8.0

# Kamerayı araziye çok daha yakın ve tamamen yataya yakın (açılı) bir konuma alalım
cam = bpy.context.scene.camera
if cam:
    # Arazinin güney ucundan (Y: -10000) merkeze ve kuzeye doğru (Y+) bakalım
    # Yükseklik 1500 metre civarında olsun
    cam.location = (0, -12000, 2500)
    
    # Kamerayı neredeyse karşıya (ufuğa) bakacak şekilde rotasyon verelim
    # X ekseninde 75 derece (0 tam aşağı, 90 tam ufuk)
    cam.rotation_euler = (math.radians(75), 0, 0)
    
    # Görüş mesafesini (Clip End) artıralım ki dağlar kesilmesin
    cam.data.clip_end = 50000
    
    out_path = os.path.join(public_dir, "screenshot_angled.png")
    bpy.context.scene.render.filepath = out_path
    print(f"Rendering {out_path}...")
    bpy.ops.render.render(write_still=True)
    print("Render tamamlandı!")
else:
    print("Kamera bulunamadı!")
