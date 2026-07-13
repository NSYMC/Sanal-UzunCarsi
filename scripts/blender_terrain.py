import bpy
import os
import json

base_dir = "C:/Users/Enes/Desktop/uzuncarsi"
public_dir = os.path.join(base_dir, "public")

heightmap_path = os.path.join(public_dir, "heightmap.png")
texture_path = os.path.join(public_dir, "texture.jpg")
config_path = os.path.join(public_dir, "terrain_config.json")
blend_out = os.path.join(base_dir, "terrain.blend")

width_m = 10000
height_m = 10000
range_m = 1000
min_m = 0

if os.path.exists(config_path):
    with open(config_path, "r") as f:
        config = json.load(f)
        width_m = config.get("width_m", width_m)
        height_m = config.get("height_m", height_m)
        range_m = config.get("range", range_m)
        min_m = config.get("minHeight", min_m)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

bpy.ops.mesh.primitive_plane_add(size=1, enter_editmode=False, align='WORLD', location=(0, 0, 0))
plane = bpy.context.active_object
plane.name = "Terrain"
plane.scale = (width_m, height_m, 1)

bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.subdivide(number_cuts=1000)
bpy.ops.object.mode_set(mode='OBJECT')

subsurf = plane.modifiers.new(name="Subsurf", type='SUBSURF')
subsurf.subdivision_type = 'SIMPLE'
subsurf.levels = 1
subsurf.render_levels = 1

if os.path.exists(heightmap_path):
    img_height = bpy.data.images.load(heightmap_path)
    
    tex_displace = bpy.data.textures.new("DisplaceTex", type='IMAGE')
    tex_displace.image = img_height
    
    displace = plane.modifiers.new(name="Displace", type='DISPLACE')
    displace.texture = tex_displace
    displace.texture_coords = 'UV' 
    displace.strength = range_m
    displace.mid_level = 0.0

if os.path.exists(texture_path):
    mat = bpy.data.materials.new(name="TerrainMat")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    
    if 'Specular IOR Level' in bsdf.inputs:
        bsdf.inputs['Specular IOR Level'].default_value = 0.0
    elif 'Specular' in bsdf.inputs:
        bsdf.inputs['Specular'].default_value = 0.0
    
    if 'Roughness' in bsdf.inputs:
        bsdf.inputs['Roughness'].default_value = 0.9
        
    tex_node = mat.node_tree.nodes.new('ShaderNodeTexImage')
    tex_node.image = bpy.data.images.load(texture_path)
    
    mat.node_tree.links.new(bsdf.inputs['Base Color'], tex_node.outputs['Color'])
    plane.data.materials.append(mat)

bpy.ops.object.shade_smooth()

bpy.ops.object.camera_add(enter_editmode=False, align='WORLD', location=(0, -height_m/2, range_m * 2), rotation=(1.1, 0, 0))
cam = bpy.context.active_object
cam.data.clip_end = max(width_m, height_m) * 2 
bpy.context.scene.camera = cam

bpy.ops.object.light_add(type='SUN', radius=1, align='WORLD', location=(0, 0, range_m * 2))
sun = bpy.context.active_object
sun.data.energy = 5.0

bpy.ops.wm.save_as_mainfile(filepath=blend_out)
