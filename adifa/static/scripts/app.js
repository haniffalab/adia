(function ($) {
  $(document).ready(function () {
    // Enable popovers everywhere.
    $('[data-toggle="popover"]').popover()
    // Enable tooltips everywhere.
    $('[data-toggle="tooltip"]').tooltip()
    // Sidebar toggles
    $('.toggle-sidebar').click(function (e) {
      $('.main-sidebar').toggleClass('open')
    })
    // Init scatterplot
    if ($('#canvas-container').length) {
      const scatterplot = $('#canvas-container').scatterplot()
      // Add events
      // Accordion animations
      $('.obs-values').on('show.bs.collapse', function () {
        $(this).prev('.list-group-item').find('.fa').removeClass('fa-plus-square').addClass('fa-caret-square-up')
        setTimeout(function (el) { scatterplot.colorize(el) }, 100, this) // Defer to improve UX
      }).on('shown.bs.collapse', function () {
        // $('.main-sidebar .nav-wrapper').animate({
        //     scrollTop: $(this).prev(".list-group-item").position().top - 61
        // }, 500, "swing");
      }).on('hide.bs.collapse', function () {
        $(this).prev('.list-group-item').find('.fa').removeClass('fa-caret-square-up').addClass('fa-plus-square')
      })

      $('.colourise').on('click', function (event) {
        if (scatterplot) {
          scatterplot.colorize(this)
          const genes = document.querySelector('#genes')
          if (genes) {
            genes.deselect(genes.selectedItems[0])
          }
        }
      })

      $('#genes').on('update', function (event) {
        if (this.selectedItems[0] && this.selectedItems[0] !== $('#color-scale-value').text() && scatterplot) scatterplot.colorize(this)
      })

      $(document.body).on('click', '.btn-gene-select', function (event) {
        if ($(this).text() !== $('#color-scale-value').text() && scatterplot) scatterplot.colorize(this)
      })

      $('.obs_value_cb').click(function (event) {
        setTimeout(function () { scatterplot.redraw() }, 100) // Defer to improve UX
      })

      $('.checkall').click(function (event) {
        $('#collapse' + $(this).data('id')).find('input[type=checkbox]').prop('checked', true)
        setTimeout(function () { scatterplot.redraw() }, 100) // Defer to improve UX
      })

      $('.uncheckall').click(function (event) {
        $('#collapse' + $(this).data('id')).find('input[type=checkbox]').prop('checked', false)
        setTimeout(function () { scatterplot.redraw() }, 100) // Defer to improve UX
      })

      $('#color-scale-remove').click(function (event) {
        scatterplot.removeColor(this)
      })

      $('body').on('click', '.canvas-obsm-key', function (event) {
        scatterplot.embedding(this)
      })

      $('#canvas-zoom-reset').click(function (event) {
        scatterplot.resetZoom(this)
      })

      $('#canvas-zoom-plus').click(function (event) {
        scatterplot.zoomIn(this)
      })

      $('#canvas-zoom-minus').click(function (event) {
        scatterplot.zoomOut(this)
      })
    }

    // Init matrixplot
    if ($('#matrixplot-container').length) {
      const scatterplot = $('#matrixplot-container').matrixplot()
      // Add events
      $(document.body).on('change', '#palette', function (event) {
        scatterplot.changePalette($(this).val())
      })
      // Accordion animations
      $('.obs-values').on('show.bs.collapse', function () {
        $(this).prev('.list-group-item').find('.fa').removeClass('fa-plus-square').addClass('fa-caret-square-up')
        setTimeout(function (el) { scatterplot.interact(el) }, 100, this) // Defer to improve UX
      }).on('shown.bs.collapse', function () {
        // $('.main-sidebar .nav-wrapper').animate({
        //     scrollTop: $(this).prev(".list-group-item").position().top - 61
        // }, 500, "swing");
      }).on('hide.bs.collapse', function () {
        $(this).prev('.list-group-item').find('.fa').removeClass('fa-caret-square-up').addClass('fa-plus-square')
      })

      $('.obs_value_cb').click(function (event) {
        setTimeout(function () { scatterplot.redraw() }, 100) // Defer to improve UX
      })

      $('.checkall').click(function (event) {
        $('#collapse' + $(this).data('id')).find('input[type=checkbox]').prop('checked', true)
        setTimeout(function () { scatterplot.redraw() }, 100) // Defer to improve UX
      })

      $('.uncheckall').click(function (event) {
        $('#collapse' + $(this).data('id')).find('input[type=checkbox]').prop('checked', false)
        setTimeout(function () { scatterplot.redraw() }, 100) // Defer to improve UX
      })

      $('#canvas-gene-reset').click(function (event) {
        scatterplot.resetGenes(this)
      })

      $(document.body).on('click', '.btn-gene-select', function (event) {
        if ($(this).text() !== $('#color-scale-value').text() && scatterplot) scatterplot.genes(this)
      })
    }
  })
})(jQuery)
