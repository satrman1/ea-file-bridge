# Snippety

## Sestavení cesty browseru
```sql
LEFT OUTER JOIN
(
SELECT t_object.Object_ID
     , isnull(p9.Name+'.','')
     + isnull(p8.Name+'.','')
     + isnull(p7.Name+'.','')
     + isnull(p6.Name+'.','')
     + isnull(p5.Name+'.','')
     + isnull(p4.Name+'.','')
     + isnull(p3.Name+'.','')
     + isnull(p2.Name+'.','')
     + isnull(p1.Name,'.') + '.'
     + t_object.Name as NodePath
FROM t_object
LEFT JOIN t_package p1 on t_object.Package_ID = p1.Package_ID
LEFT JOIN t_package p2 on p1.Parent_ID = p2.Package_ID
LEFT JOIN t_package p3 on p2.Parent_ID = p3.Package_ID
LEFT JOIN t_package p4 on p3.Parent_ID = p4.Package_ID
LEFT JOIN t_package p5 on p4.Parent_ID = p5.Package_ID
LEFT JOIN t_package p6 on p5.Parent_ID = p6.Package_ID
LEFT JOIN t_package p7 on p6.Parent_ID = p7.Package_ID
LEFT JOIN t_package p8 on p7.Parent_ID = p8.Package_ID
LEFT JOIN t_package p9 on p8.Parent_ID = p9.Package_ID
) NodePath on t_object.Object_ID = NodePath.Object_id
```
## Sestavení cesty ze zanořených objektů v browseru

```sql
LEFT OUTER JOIN
(
SELECT t_object.Object_ID
     , isnull(t_object_5.ea_guid+'.','')
     + isnull(t_object_4.ea_guid+'.','')
     + isnull(t_object_3.ea_guid+'.','')
     + isnull(t_object_2.ea_guid+'.','')
     + isnull(t_object_1.ea_guid,'.') + '.'
     + t_object.ea_guid as GuidPath
FROM t_object
LEFT JOIN t_object AS t_object_1 ON t_object.ParentID = t_object_1.Object_ID
LEFT JOIN t_object AS t_object_2 ON t_object_1.ParentID = t_object_2.Object_ID
LEFT JOIN t_object AS t_object_3 ON t_object_2.ParentID = t_object_3.Object_ID
LEFT JOIN t_object AS t_object_4 ON t_object_3.ParentID = t_object_4.Object_ID
LEFT JOIN t_object AS t_object_5 ON t_object_4.ParentID = t_object_5.Object_ID
) GuidPath on t_object.Object_ID = GuidPath.Object_id
```

## Ošetření češtiny a zalamovacích znaků v Notes polích

```sql
,replace(replace(isnull(cast(TRY_CONVERT(xml, t_object.Note) as nvarchar(max)),t_object.Note), char(10), ' '), char(59), '|') as StableNote
```

## Pole Period na agregování po měsících

```sql
,Cast(year(t_object.ModifiedDate) as varchar(4))+'-'+ right('00'+Cast(month(t_object.ModifiedDate) as varchar(4)),2) as Period
```
