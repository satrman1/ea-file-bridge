// AICodeBridge.SetTag(el, tagName, value)
for (var i = 0; i < el.TaggedValues.Count; i++) {
    var tv = el.TaggedValues.GetAt(i);
    if (tv.Name == tagName) {
        tv.Value = value;
        tv.Update();
        el.TaggedValues.Refresh();
        return;
    }
}
var ntv = el.TaggedValues.AddNew(tagName, value);
ntv.Update();
el.TaggedValues.Refresh();
