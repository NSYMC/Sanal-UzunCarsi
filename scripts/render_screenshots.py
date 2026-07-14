import bpy
import os

base_dir = "C:/Users/Enes/Desktop/uzuncarsi"
public_dir = os.path.join(base_dir, "public")

# 1. Kamerayı yukarıdan açılı bakacak şekilde ayarla
cam = bpy.context.scene.camera
if cam:
    # Biraz daha yaklaşalım
    cam.location = (0, -3000, 4000)
    cam.rotation_euler = (0.8, 0, 0)
    
    # Çözünürlüğü ayarla (1920x1080)
    bpy.context.scene.render.resolution_x = 1920
    bpy.context.scene.render.resolution_y = 1080
    bpy.context.scene.render.resolution_percentage = 100
    
    # Render Motoru (EEVEE)
    bpy.context.scene.render.engine = 'BLENDER_EEVEE_NEXT' if hasattr(bpy.types.Scene, 'eevee') else 'BLENDER_EEVEE'
    
    # Ekran Görüntüsü 1'i Render Al
    out_path = os.path.join(public_dir, "screenshot1.png")
    bpy.context.scene.render.filepath = out_path
    print(f"Rendering {out_path}...")
    bpy.ops.render.render(write_still=True)
    
    # İkinci açı: Tam tepeden (Harita görünümü)
    cam.location = (0, 0, 10000)
    cam.rotation_euler = (0, 0, 0)
    out_path2 = os.path.join(public_dir, "screenshot2.png")
    bpy.context.scene.render.filepath = out_path2
    print(f"Rendering {out_path2}...")
    bpy.ops.render.render(write_still=True)
    
    print("Render tamamlandı!")
else:
    print("Kamera bulunamadı!")
