import bpy
import os
import math

base_dir = "C:/Users/Enes/Desktop/uzuncarsi"
public_dir = os.path.join(base_dir, "public")

# Render ayarları
bpy.context.scene.render.resolution_x = 1920
bpy.context.scene.render.resolution_y = 1080
bpy.context.scene.render.engine = 'BLENDER_EEVEE_NEXT' if hasattr(bpy.types.Scene, 'eevee') else 'BLENDER_EEVEE'

# Güneşi bul ve açısını ayarla ki gölgeler 3D olduğunu belli etsin
sun = None
for obj in bpy.context.scene.objects:
    if obj.type == 'LIGHT' and obj.data.type == 'SUN':
        sun = obj
        break

if sun:
    # Güneşi yatay bir açıya getirerek (örneğin 45 derece) dağların gölge yapmasını sağla
    sun.rotation_euler = (math.radians(60), math.radians(45), 0)
    sun.data.energy = 8.0 # Biraz parlaklık verelim gölgelerle dengelesin

# Kamerayı tam tepeye koy
cam = bpy.context.scene.camera
if cam:
    cam.location = (0, 0, 15000) # Biraz daha yukarı
    cam.rotation_euler = (0, 0, 0) # Tam aşağı bakıyor
    
    out_path = os.path.join(public_dir, "screenshot_topdown_3d.png")
    bpy.context.scene.render.filepath = out_path
    print(f"Rendering {out_path}...")
    bpy.ops.render.render(write_still=True)
    print("Render tamamlandı!")
else:
    print("Kamera bulunamadı!")
