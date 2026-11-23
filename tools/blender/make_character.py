# Builds a realistic female character with MakeHuman (MPFB) inside Blender, renders preview images and exports a rigged GLB.
#   blender -b --python make_character.py -- <out_dir>
import bpy, os, sys, math, traceback
from bl_ext.user_default.mpfb.services.humanservice import HumanService as H
from bl_ext.user_default.mpfb.services.locationservice import LocationService as Loc

out = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else os.getcwd()
os.makedirs(out, exist_ok=True)
U = Loc.get_user_data()
bpy.ops.wm.read_factory_settings(use_empty=True)

macro = {"gender": 0.0, "age": 0.5, "muscle": 0.62, "weight": 0.42, "proportions": 0.8, "height": 0.55, "cupsize": 0.45, "firmness": 0.65,
         "race": {"asian": 0.0, "caucasian": 1.0, "african": 0.0}}
body = H.create_human(scale=0.1, macro_detail_dict=macro, feet_on_ground=True)
body.name = "Body"

def step(label, fn):
    try:
        r = fn(); print("OK  ", label); return r
    except Exception:
        print("FAIL", label); traceback.print_exc(); return None

MAT = os.environ.get("MATTYPE", "GAMEENGINE")
step("skin", lambda: H.set_character_skin(os.path.join(U, "skins/young_caucasian_female/young_caucasian_female.mhmat"), body, skin_type=MAT))
rig = step("rig", lambda: H.add_builtin_rig(body, "mixamo", import_weights=True))

def asset(rel, kind):
    return step(kind + " " + rel, lambda: H.add_mhclo_asset(os.path.join(U, rel), body, asset_type=kind, subdiv_levels=0, material_type=MAT))
asset("eyes/high-poly/high-poly.mhclo", "Eyes")
asset("eyebrows/eyebrow001/eyebrow001.mhclo", "Eyebrows")
asset("eyelashes/eyelashes01/eyelashes01.mhclo", "Eyelashes")
asset("teeth/teeth_base/teeth_base.mhclo", "Teeth")
asset("hair/ponytail01/ponytail01.mhclo", "Hair")
asset("clothes/female_sportsuit01/female_sportsuit01.mhclo", "Clothes")
asset("clothes/shoes05/shoes05.mhclo", "Clothes")


# ---- tailoring: high-waisted leggings, a fitted top, sport colours ----
import bmesh
from mathutils import Vector
here = os.path.dirname(os.path.abspath(__file__))
suit = bpy.data.objects.get("Body.female_sportsuit01")
def tailor():
    # shrinkwrap target: the bare body only (the base mesh also carries invisible helper shells)
    tgt = body.copy(); tgt.data = body.data.copy(); bpy.context.scene.collection.objects.link(tgt); tgt.name = "FitTarget"
    for m in list(tgt.modifiers): tgt.modifiers.remove(m)
    gi = tgt.vertex_groups["body"].index
    bm = bmesh.new(); bm.from_mesh(tgt.data); dl = bm.verts.layers.deform.verify()
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if gi not in v[dl]], context="VERTS"); bm.to_mesh(tgt.data); bm.free()
    top_z = max((body.matrix_world @ v.co).z for v in body.data.vertices if gi in [g.group for g in v.groups])
    # split the suit into its pieces; the piece that reaches the ankles is the leggings
    bm = bmesh.new(); bm.from_mesh(suit.data); bm.verts.ensure_lookup_table()
    seen, islands = set(), []
    for v in bm.verts:
        if v.index in seen: continue
        stack, isl = [v], []
        seen.add(v.index)
        while stack:
            c = stack.pop(); isl.append(c.index)
            for e in c.link_edges:
                o = e.other_vert(c)
                if o.index not in seen: seen.add(o.index); stack.append(o)
        islands.append(isl)
    legs = [i for isl in islands if min(bm.verts[i].co.z for i in isl) < top_z * 0.3 for i in isl]
    tops = [i for isl in islands if min(bm.verts[i].co.z for i in isl) >= top_z * 0.3 for i in isl]
    zmax = max(bm.verts[i].co.z for i in legs); z0 = top_z * 0.49; target = top_z * 0.615            # crotch line, navel height
    # the original waistband dips at the front: stretch each column of cloth by its own amount so the new edge is level
    edge = [(math.atan2(v.co.y, v.co.x), v.co.z) for v in bm.verts if v.index in set(legs) and v.is_boundary and v.co.z > z0 + 0.05]
    def edge_z(a): return min(edge, key=lambda e: abs(math.atan2(math.sin(e[0] - a), math.cos(e[0] - a))))[1]
    for i in legs:
        v = bm.verts[i]
        if v.co.z > z0: v.co.z = z0 + (v.co.z - z0) * (target - z0) / (edge_z(math.atan2(v.co.y, v.co.x)) - z0)
    hem = min(bm.verts[i].co.z for i in tops)                                                      # let the top end a little lower, as a fitted crop top
    for i in tops:
        v = bm.verts[i]
        if v.co.z < hem + 0.1 and abs(v.co.x) < 0.2: v.co.z -= 0.035 * (1 - (v.co.z - hem) / 0.1)
    bm.to_mesh(suit.data); bm.free()
    print("TAILOR waist", round(zmax, 3), "->", round(target, 3), "islands", len(islands), "legs", len(legs), "top", len(tops))
    for name, idx, off in (("FitLegs", legs, 0.004), ("FitTop", tops, 0.006)):
        g = suit.vertex_groups.new(name=name); g.add(idx, 1.0, "REPLACE")
        m = suit.modifiers.new(name, "SHRINKWRAP"); m.target = tgt; m.wrap_method = "NEAREST_SURFACEPOINT"; m.wrap_mode = "ABOVE_SURFACE"; m.offset = off; m.vertex_group = name
        with bpy.context.temp_override(object=suit, active_object=suit, selected_objects=[suit]):
            bpy.ops.object.modifier_move_to_index(modifier=name, index=0); bpy.ops.object.modifier_apply(modifier=name)
    # skin weights follow the new shape: take them from the body surface underneath
    m = suit.modifiers.new("W", "DATA_TRANSFER"); m.object = tgt; m.use_vert_data = True; m.data_types_verts = {"VGROUP_WEIGHTS"}; m.vert_mapping = "POLYINTERP_NEAREST"
    m.layers_vgroup_select_src = "ALL"; m.layers_vgroup_select_dst = "NAME"
    with bpy.context.temp_override(object=suit, active_object=suit, selected_objects=[suit]):
        bpy.ops.object.modifier_move_to_index(modifier="W", index=0); bpy.ops.object.datalayout_transfer(modifier="W"); bpy.ops.object.modifier_apply(modifier="W")
    bpy.data.objects.remove(tgt, do_unlink=True)
    # the skin under the leggings is hidden, so a coarse cloth mesh can never let it show through
    lo = top_z * 0.085; hide = [v.index for v in body.data.vertices if lo < (body.matrix_world @ v.co).z < target - 0.012 and abs((body.matrix_world @ v.co).x) < 0.27]
    hg = body.vertex_groups.new(name="HideUnderLeggings"); hg.add(hide, 1.0, "REPLACE")
    mm = body.modifiers.new("HideUnderLeggings", "MASK"); mm.vertex_group = "HideUnderLeggings"; mm.invert_vertex_group = True
    print("HIDDEN body verts", len(hide))
    # sport colours: the recoloured texture replaces the original one
    img = bpy.data.images.load(os.path.join(here, "tex/suit_diffuse.png"))
    for slot in suit.material_slots:
        for n in slot.material.node_tree.nodes:
            if n.type == "TEX_IMAGE" and n.image and "diffuse" in n.image.name.lower(): n.image = img
if suit: step("tailor", tailor)
def no_socks():                                    # the shoes come with socks that poke through the leggings: keep only the shoe
    sh = bpy.data.objects["Body.shoes05"]; bm = bmesh.new(); bm.from_mesh(sh.data)
    zs = sorted(v.co.z for v in bm.verts); cut = float(os.environ.get("SOCKCUT", "0.105"))
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z > cut], context="VERTS"); bm.to_mesh(sh.data); bm.free(); print("SHOES z", round(zs[0], 3), round(zs[-1], 3), "cut", cut)
step("remove socks", no_socks)

print("OBJECTS", [(o.name, o.type, [m.type for m in o.modifiers] if o.type == "MESH" else "") for o in bpy.data.objects])
if rig: print("BONES", len(rig.data.bones), [b.name.replace("mixamorig:", "") for b in rig.data.bones])
bb = [body.matrix_world @ v.co for v in body.data.vertices if body.vertex_groups["body"].index in [g.group for g in v.groups]]
print("HEIGHT", min(v.z for v in bb), max(v.z for v in bb))
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out, "character.blend"))
step("export glb", lambda: bpy.ops.export_scene.gltf(filepath=os.path.join(out, "woman.glb"), export_format="GLB", export_apply=True, export_skins=True, export_animations=False, export_yup=True))

# ---- preview renders (Cycles on the CPU works without a display) ----
sc = bpy.context.scene
sc.render.engine = "CYCLES"; sc.cycles.samples = int(os.environ.get("SAMPLES", "48")); sc.cycles.use_denoising = True
sc.render.film_transparent = False
world = bpy.data.worlds.new("w"); sc.world = world; world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.84, 0.83, 0.88, 1); world.node_tree.nodes["Background"].inputs[1].default_value = 0.9
def light(name, loc, energy, size):
    d = bpy.data.lights.new(name, "AREA"); d.energy = energy; d.size = size; o = bpy.data.objects.new(name, d); sc.collection.objects.link(o); o.location = loc
    o.rotation_euler = (math.atan2(math.hypot(loc[0], loc[1]), loc[2] - 1.0), 0, math.atan2(loc[1], loc[0]) + math.pi / 2); return o
light("key", (2.5, -3.0, 3.2), 520, 3); light("fill", (-3.0, -2.0, 2.0), 160, 4); light("rim", (0.5, 3.0, 2.8), 300, 2)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
def shot(name, pos, look, lens, w, h):
    cam.location = pos; cam.data.lens = lens
    d = (look[0] - pos[0], look[1] - pos[1], look[2] - pos[2])
    cam.rotation_euler = (math.atan2(math.hypot(d[0], d[1]), -d[2]), 0, math.atan2(d[1], d[0]) - math.pi / 2)
    sc.render.resolution_x = w; sc.render.resolution_y = h; sc.render.filepath = os.path.join(out, name); bpy.ops.render.render(write_still=True)
top = max(v.z for v in bb)
step("render body", lambda: shot("body.png", (2.6, -4.2, 1.15), (0, 0, top * 0.52), 70, 640, 960))
step("render face", lambda: shot("face.png", (0.55, -1.25, top * 0.94), (0, 0, top * 0.93), 85, 640, 640))
step("render back", lambda: shot("back.png", (-2.6, 4.2, 1.15), (0, 0, top * 0.52), 70, 480, 720))
