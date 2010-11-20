ThumbnailView = function(container, post_ids, pool)
{
  this.container = container;
  this.post_ids = post_ids;
  this.expanded_post_id = null;
  this.centered_post_id = null;
  this.pool = pool;
  this.last_mouse_x = 0;
  this.last_mouse_y = 0;
  this.thumb_container_shown = true;

  this.hashchange_event = this.hashchange_event.bindAsEventListener(this);
  this.thumbnail_click_event = this.thumbnail_click_event.bindAsEventListener(this);
  this.thumbnail_dblclick_event = this.thumbnail_dblclick_event.bindAsEventListener(this);
  this.mouse_wheel_event = this.mouse_wheel_event.bindAsEventListener(this);

  this.container.observe("DOMMouseScroll", this.mouse_wheel_event);
  this.container.observe("mousewheel", this.mouse_wheel_event);

  Post.observe_finished_loading(this.displayed_image_finished_loading.bind(this));

  OnKey(65, { AlwaysAllowOpera: true, allowRepeat: true }, function(e) { this.show_next_post(true); }.bind(this));
  OnKey(83, { AlwaysAllowOpera: true, allowRepeat: true }, function(e) { this.show_next_post(false); }.bind(this));
//  OnKey(32, { AlwaysAllowOpera: true }, function(e) { this.toggle_thumb_bar(); }.bind(this));

  /* We need to watch for space presses during keypress rather than keydown, since
   * for some reason cancelling during the keydown event won't prevent the browser
   * default behavior like it probably should. */
  this.document_keypress_event = this.document_keypress_event.bindAsEventListener(this);
  Element.observe(document, "keypress", this.document_keypress_event);

  this.ignore_hash_changes_until = 0;
  Element.observe(window, "hashchange", this.hashchange_event);

  this.document_mousemove_event = this.document_mousemove_event.bindAsEventListener(this);
  this.container.observe("mousemove", this.document_mousemove_event);

  this.container_mouseover_event = this.container_mouseover_event.bindAsEventListener(this);
  this.container_mouseout_event = this.container_mouseout_event.bindAsEventListener(this);
  this.container.observe("mouseover", this.container_mouseover_event);
  this.container.observe("mouseout", this.container_mouseout_event);

  for(var i = 0; i < post_ids.length; ++i)
  {
    var thumb = this.create_thumb(post_ids[i]);
    container.down(".post-browser-posts").appendChild(thumb);
  }

  var initial_post_id = this.get_current_post_id();

  this.center_on_post(initial_post_id);
  this.focus_post(initial_post_id);
  this.set_active_post(initial_post_id);
}

ThumbnailView.prototype.container_mouseover_event = function(event)
{
  var li = event.target.up(".post-thumb");
  if(!li)
    return;
  var post_id = li.post_id;

  this.expand_post(post_id);
}

ThumbnailView.prototype.container_mouseout_event = function(event)
{
}

ThumbnailView.prototype.document_keypress_event = function(e) {
  var key = e.charCode;
  if(key == null)
    key = e.keyCode; /* Opera */
  if (key != 32)
    return;
  if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey)
    return;

  this.toggle_thumb_bar();
  e.stop();
}


ThumbnailView.prototype.hashchange_event = function(e)
{
  var new_post_id = this.get_current_post_id();

  /*
   * There's an annoying bug in FF: the hashchange event isn't delivered immediately
   * when the hash changes, but queued and sent later.  This causes ugly race conditions;
   * we can't tell whether hash changes are coming from the user requesting a state
   * change, or if they're from us updating the current--and now possibly out-of-date--state.
   * The effect of this is that quick changes to the active post can be lost, leaving us
   * on a different post than was requested.
   *
   * Work around this with a hack: after setting a new hash, ignore changes to the hash for
   * a little while.  The events are dispatched after we return from whatever event we're
   * handling.
   */
  if((new Date()).valueOf() < this.ignore_hash_changes_until)
    return;

  this.center_on_post(new_post_id);
  this.focus_post(new_post_id);
  this.set_active_post(new_post_id);
}

ThumbnailView.prototype.get_current_post_id = function()
{
  var hash = document.location.hash;
  if(!hash)
    return this.post_ids[0];
  hash = hash.substr(1);
  var post_id = parseInt(hash);
  if(this.post_id_idx(post_id) == -1)
    return this.post_ids[0];

  return post_id;
}

ThumbnailView.prototype.document_mousemove_event = function(e) {
  var x = e.pointerX();
  var y = e.pointerY() - document.documentElement.scrollTop;
  this.last_mouse_x = x;
  this.last_mouse_y = y;
}

ThumbnailView.prototype.mouse_wheel_event = function(event)
{
  event.preventDefault();

  var val;
  if(event.wheelDelta)
  {
    val = event.wheelDelta;
    if (window.opera)
      val = -val;
  } else if (event.detail) {
    val = -event.detail;
  }

  this.scroll(val >= 0, true);
}

ThumbnailView.prototype.post_id_idx = function(post_id)
{
  for(var i = 0; i < this.post_ids.length; ++i)
  {
    if(this.post_ids[i] == post_id)
      return i;
  }
  return -1;
}

ThumbnailView.prototype.set_active_post = function(post_id, lazy)
{
  this.active_post_id = post_id;

  if(lazy)
  {
    /* Ask the pool browser to load the new post, with a delay in case we're
     * scrolling quickly. */
    pool_browser.lazily_load(post_id);
  } else {
    pool_browser.set_post(post_id);
  }
}

ThumbnailView.prototype.show_next_post = function(up)
{
  var active_post_id = this.active_post_id;
  var current_idx = this.post_id_idx(active_post_id);
  var new_idx = current_idx + (up? -1:+1);

  if(new_idx < 0)
  {
    notice("Continued from the end");
    new_idx = this.post_ids.length - 1;
  }
  else if(new_idx >= this.post_ids.length)
  {
    notice("Starting over from the beginning");
    new_idx = 0;
  }

  var new_post_id = this.post_ids[new_idx];
  this.center_on_post(new_post_id);
  this.expand_post(new_post_id);
  this.set_active_post(new_post_id, true);
}

/* Scroll the thumbnail view left or right.  Don't change the displayed post. */
ThumbnailView.prototype.scroll = function(up)
{
  var current_post_id = this.centered_post_id;
  var current_idx = this.post_id_idx(current_post_id);
  var new_idx = current_idx + (up? -1:+1);

  /* Wrap the new index. */
  // XXX: only notice() if we're not expanded
  if(new_idx < 0)
  {
    notice("Continued from the end");
    new_idx = this.post_ids.length - 1;
  }
  else if(new_idx >= this.post_ids.length)
  {
    notice("Starting over from the beginning");
    new_idx = 0;
  }

  var new_post_id = this.post_ids[new_idx];
  this.center_on_post_for_scroll(new_post_id);
}

/* This calls center_on_post, and also unexpands and reexpands posts correctly to avoid flicker. */
ThumbnailView.prototype.center_on_post_for_scroll = function(post_id)
{
  /*
   * Centering on a new post is likely to change which one we're hovering over.  Unexpand
   * the current post before scrolling, so the post doesn't flicker expanded in a new position
   * before being un-expanded by the mouseover event.
   */
  this.expand_post(null);

  this.center_on_post(post_id);

  /*
   * Now that we've re-centered, we need to expand the correct image.  Usually, we can just
   * wait for the mouseover event to fire, which will expand the element we're hovering over
   * after centering on the new post.  However, in some cases we won't actually change which
   * one we're hovering over, eg. if the mouse is over the edge of a landscape image, and
   * after scrolling the mouse is centered over the same image.  Explicitly figure out which
   * item we're hovering over and expand it.
   */
  var element = document.elementFromPoint(this.last_mouse_x, this.last_mouse_y);
  if(element)
  {
    var li = element.up(".post-thumb");
    if(li)
    {
      var post_id = li.post_id;
      this.expand_post(post_id);
    }
  }
}

ThumbnailView.prototype.center_on_post = function(post_id)
{
  /* 
   * We have to jump some hoops to scroll the thumbs correctly.  We should be able to
   * set the container to overflow-x: hidden and just change scrollLeft to scroll the
   * contents.  Unfortunately, we also need overflow-y: visible to allow expanded thumbs
   * to draw outside of the container, and most browsers don't handle "overflow: hidden visible",
   * mysteriously changing it to "auto visible".
   *
   * Since the container is set to visible, we can't scroll it that way.  Instead, we've
   * inserted a padding entry at the beginning.  To scroll the whole list, we'll change
   * its marginLeft.  Setting a negative margin works the way we want, causing the list to
   * scroll to the left.
   */
  var padding = this.container.down(".post-padding");

  var thumb = $("p" + post_id);
  var img = thumb.down(".preview");

  /* We always center the thumb.  Don't clamp to the edge when we're near the first or last
   * item, so we always have empty space on the sides for expanded landscape thumbnails to
   * be visible. */
  var center_on_position = this.container.offsetWidth/2;

  /* Clear the padding before calculating the new padding. */
  padding.setStyle({marginLeft: 0});

  var shift_pixels_right = center_on_position - img.width/2 - img.cumulative_offset_range_x(img.up("UL"));

  /* As of build 3516 (10.63), Opera is handling offsetLeft for elements inside fixed containers
   * incorrectly: they're affected by the scroll position, even though the nodes aren't.  This
   * is annoying to work around; let's just subtract out the error.  This will break if Opera fixes
   * this bug, in which case we can remove this and expect people to upgrade.  */
  if(window.opera)
    shift_pixels_right += document.documentElement.scrollLeft;

  padding.setStyle({marginLeft: shift_pixels_right + "px"});

  this.centered_post_id = post_id;
}

ThumbnailView.prototype.expand_post = function(post_id)
{
  if(this.expanded_post_id != null)
  {
    var old_thumb = $("p" + this.expanded_post_id);
    old_thumb.removeClassName("expanded");
  }

  this.expanded_post_id = post_id;
  if(post_id == null)
    return;

  var thumb = $("p" + post_id);
  thumb.addClassName("expanded");
}

ThumbnailView.prototype.focus_post = function(post_id)
{
  /* If we're browsing a pool, set the title. */
  if(this.pool)
  {
    var post = Post.posts.get(post_id);
    title = this.pool.name.replace(/_/g, " ");

    if(post.pool_post)
    {
      var sequence = post.pool_post.sequence;
      title += " ";
      if(sequence.match(/^[0-9]/))
        title += "#";
      title += sequence;
    }

    document.title = title;
  }

  this.ignore_hash_changes_until = (new Date()).valueOf() + 100;
  document.location.hash = post_id;
}

ThumbnailView.prototype.create_thumb = function(post_id)
{
  var post = Post.posts.get(post_id);

  var width = post.actual_preview_width;
  var height = post.actual_preview_height;
/*
  var block_size = [width, 200];
  var crop_left = 0;
*/
  /* This crops blocks that are too wide, but doesn't pad them if they're too
   * narrow, since that creates odd spacing. */
  var block_size = [200, 200];
  if(width < block_size[0])
    block_size[0] = width;
  var visible_width = block_size[0];
  if(width < visible_width)
    visible_width = width;
  var crop_left = (width - visible_width) / 2;

  var div =
    '<div class="inner" style="width: ${block_size_x}px; height: ${block_size_y}px;">' + 
      '<a class="thumb" href="${target_url}">' +
        '<img src="about:blank" thumb:src="${preview_url}" style="margin-left: -${crop_left}px;" alt="" class="${image_class}" width="${width}" height="${height}">'
      '</a>' +
    '</div>';
  div = div.subst({
    block_size_x: block_size[0],
    block_size_y: block_size[1],
    target_url: "/post/show/" + post.id,
    preview_url: post.preview_url,
    crop_left: crop_left,
    width: width,
    height: height,
    image_class: "preview"
  });
  var li_class = "post-thumb";
  li_class += " creator-id-" + post.creator_id;
  if(post.status == "flagged") li_class += " flagged";
  if(post.has_children) li_class += " has-children";
  if(post.parent_id) li_class += " has-parent";
  if(post.status == "pending") li_class += " pending";

  var item = createElement("li", li_class, div);
  item.id = "p" + post_id;

  item.post_id = post_id;

  // We need to specify a width on the <li>, since IE7 won't figure it out on its own.
  item.setStyle({width: block_size[0] + "px"});

  item.down("A.thumb").observe("click", this.thumbnail_click_event);
  item.down("A.thumb").observe("dblclick", this.thumbnail_dblclick_event);

  return item;
}

ThumbnailView.prototype.thumbnail_click_event = function(event)
{
  event.preventDefault();
  var li = event.target.up("LI");
  this.focus_post(li.post_id);
  this.set_active_post(li.post_id);
}

ThumbnailView.prototype.thumbnail_dblclick_event = function(event)
{
  this.show_thumb_bar(false)
}

ThumbnailView.prototype.show_thumb_bar = function(shown)
{
  this.thumb_container_shown = shown;
  this.container.show(shown);
}

ThumbnailView.prototype.toggle_thumb_bar = function()
{
  this.show_thumb_bar(!this.thumb_container_shown);
}


/* Return the next or previous post, wrapping around if necessary. */
ThumbnailView.prototype.get_adjacent_post_id_wrapped = function(post_id, next)
{
  var idx = this.post_id_idx(post_id);
  idx += next? +1:-1;
  idx = (idx + this.post_ids.length) % this.post_ids.length;
  return this.post_ids[idx];
}

ThumbnailView.prototype.displayed_image_finished_loading = function(success, post_id, event)
{
  /*
   * The image in the post we're displaying is finished loading.
   *
   * Preload the next and previous posts.  Normally, one or the other of these will
   * already be in cache.
   *
   * XXX: doesn't always make sense: the browser may be getting ready to switch to something else
   */
  // var post_id = this.displayed_post_id;
  var post_ids_to_preload = [];
  var adjacent_post_id = this.get_adjacent_post_id_wrapped(post_id, true);
  if(adjacent_post_id != null)
    post_ids_to_preload.push(adjacent_post_id);
  var adjacent_post_id = this.get_adjacent_post_id_wrapped(post_id, false);
  if(adjacent_post_id != null)
    post_ids_to_preload.push(adjacent_post_id);
  pool_browser.preload(post_ids_to_preload);
}

